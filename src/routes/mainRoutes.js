// src/routes/mainRoutes.js
const express = require('express');
const router = express.Router();
const { oauth2Client } = require('../config/clients');
const twilioService = require('../services/twilioService');
const aiService = require('../services/aiService');
const calendarService = require('../services/calendarService');
const dbService = require('../services/dbService');

router.get('/', (req, res) => res.send('¡El Asistente de Calendario está funcionando!'));

router.get('/auth', (req, res) => {
    const { whatsappNumber } = req.query;
    if (!whatsappNumber) return res.status(400).send("Falta el número de WhatsApp.");
    const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: ['https://www.googleapis.com/auth/calendar'], state: whatsappNumber });
    res.redirect(authUrl);
});

router.get('/oauth2callback', async (req, res) => {
    const { code, state: whatsappNumber } = req.query;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        if (tokens.refresh_token) {
            await dbService.saveUserTokens(whatsappNumber, tokens);
            await twilioService.sendWhatsAppMessage(whatsappNumber, "¡Autenticación exitosa! ✨ Ya puedes enviarme eventos.");
            res.send("¡Autenticación exitosa! Ya puedes cerrar esta ventana.");
        } else {
             await twilioService.sendWhatsAppMessage(whatsappNumber, "¡Listo! Ya estabas autenticado. ✨");
             res.send("¡Re-autenticación exitosa! Ya puedes cerrar esta ventana.");
        }
    } catch (error) {
        const errorDetails = error.response?.data || {};
        const errorType = errorDetails.error || "Error";
        const errorDescription = errorDetails.error_description || "No hay descripción.";
        res.status(error.response?.status || 500).send(`<html><body><h1>Error</h1><p><strong>Tipo:</strong> ${errorType}</p><p><strong>Descripción:</strong> ${errorDescription}</p></body></html>`);
    }
});

router.post('/whatsapp', async (req, res) => {
    const from = req.body.From;
    const incomingMsg = req.body.Body;
    console.log(`\n--- NUEVO MENSAJE de ${from}: "${incomingMsg}" ---`);

    const userDoc = await dbService.getUser(from);
    if (!userDoc.exists || !userDoc.data().refreshToken) {
        const authUrl = `${process.env.BASE_URL}/auth?whatsappNumber=${encodeURIComponent(from)}`;
        const message = `¡Hola! Para usar el asistente, necesito permiso para acceder a tu calendario. Por favor, visita este enlace:\n\n${authUrl}`;
        await twilioService.sendWhatsAppMessage(from, message);
        return res.status(200).send();
    }

    const userData = userDoc.data();
    const refreshToken = userData.refreshToken;
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    
    // Para la edición, no pasamos contexto aún, la IA lo determinará primero.
    const initialAiResponse = await aiService.extractEventDetails(incomingMsg);
    const intent = initialAiResponse.intent;
    let details = initialAiResponse.details;

    try {
        const { token: accessToken } = await oauth2Client.getAccessToken();
        const currentTokens = { refresh_token: refreshToken, access_token: accessToken };

        switch (intent) {
            case 'create':
                const newEvent = await calendarService.createCalendarEvent(currentTokens, details);
                if (newEvent && newEvent.id) {
                    await dbService.saveLastEventId(from, newEvent.id);
                    await twilioService.sendWhatsAppMessage(from, `✅ ¡Evento "${newEvent.summary}" agendado!`);
                } else {
                    await twilioService.sendWhatsAppMessage(from, `❌ Hubo un error al crear tu evento.`);
                }
                break;

            case 'edit':
                const lastEventId = userData.lastEventId;
                if (!lastEventId) {
                    await twilioService.sendWhatsAppMessage(from, `🤔 No encontré un evento reciente para editar. Intenta crear uno primero.`);
                    break;
                }

                // 1. Obtenemos el evento original desde Google Calendar
                const originalEvent = await calendarService.getSingleEvent(currentTokens, lastEventId);
                if (!originalEvent) {
                    await twilioService.sendWhatsAppMessage(from, `❌ No pude encontrar los detalles de tu último evento.`);
                    break;
                }
                
                // 2. Creamos el contexto y volvemos a llamar a la IA para que fusione los datos
                const context = { 
                    intent: 'edit', 
                    originalEvent: {
                        title: originalEvent.summary,
                        startTime: originalEvent.start.dateTime,
                        endTime: originalEvent.end.dateTime,
                        location: originalEvent.location,
                        description: originalEvent.description
                    }
                };
                const finalAiResponse = await aiService.extractEventDetails(incomingMsg, context);
                details = finalAiResponse.details; // Usamos los detalles completos y fusionados

                // 3. Usamos la respuesta completa de la IA para actualizar
                const editedEvent = await calendarService.editCalendarEvent(currentTokens, lastEventId, details);
                
                if (editedEvent) {
                    await twilioService.sendWhatsAppMessage(from, `✅ ¡Listo! Actualicé tu último evento a: "${editedEvent.summary}".`);
                } else {
                    await twilioService.sendWhatsAppMessage(from, `❌ No pude modificar tu último evento.`);
                }
                break;

// Dentro del switch (intent) en src/routes/mainRoutes.js

            case 'delete':
                console.log("-> Intención 'delete' reconocida."); // Informante 1
                const eventIdToDelete = userData.lastEventId;

                if (!eventIdToDelete) {
                    console.log("-> ERROR: No se encontró 'lastEventId' en la base de datos para este usuario."); // Informante 2
                    await twilioService.sendWhatsAppMessage(from, `🤔 No encontré un evento reciente para cancelar. Intenta crear uno primero.`);
                    break;
                }

                console.log(`-> Se intentará borrar el evento con ID: ${eventIdToDelete}`); // Informante 3
                const deleted = await calendarService.deleteCalendarEvent(currentTokens, eventIdToDelete);

                if (deleted) {
                    console.log("-> ÉXITO: El evento fue borrado de Google Calendar."); // Informante 4
                    await twilioService.sendWhatsAppMessage(from, `✅ ¡Listo! Cancelé tu último evento.`);
                } else {
                    console.log("-> ERROR: La función deleteCalendarEvent de calendarService falló."); // Informante 5
                    await twilioService.sendWhatsAppMessage(from, `❌ No pude cancelar tu último evento.`);
                }
                break;

            case 'query':
                console.log("-> Intención 'query' reconocida."); // Informante 1
                const { timeMin, timeMax } = details;

                if (!timeMin || !timeMax) {
                    console.log("-> ERROR: Faltan timeMin o timeMax en los detalles de la IA."); // Informante 2
                    await twilioService.sendWhatsAppMessage(from, '🤔 No entendí qué período de tiempo quieres revisar.');
                    break;
                }

                console.log(`-> Buscando eventos entre ${timeMin} y ${timeMax}`); // Informante 3
                const events = await calendarService.getCalendarEvents(currentTokens, timeMin, timeMax);
                
                if (events && events.length > 0) {
                    console.log(`-> Se encontraron ${events.length} evento(s).`); // Informante 4
                    let responseText = 'Esto es lo que tienes agendado:\n';
                    events.forEach(event => {
                        const start = new Date(event.start.dateTime || event.start.date);
                        const time = start.toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' });
                        responseText += `\n• ${event.summary} (a las ${time})`;
                    });
                    await twilioService.sendWhatsAppMessage(from, responseText);
                } else if (events) { // events es un array vacío []
                    console.log("-> No se encontraron eventos en el período."); // Informante 5
                    await twilioService.sendWhatsAppMessage(from, '✅ ¡Buenas noticias! No tienes ningún evento agendado para ese período.');
                } else { // events es null
                    console.log("-> ERROR: La función getCalendarEvents de calendarService falló."); // Informante 6
                    await twilioService.sendWhatsAppMessage(from, '❌ Lo siento, no pude revisar tu calendario en este momento.');
                }
                break;

            default:
                await twilioService.sendWhatsAppMessage(from, `🤔 No estoy seguro de cómo ayudarte con eso.`);
                break;
        }
    } catch (error) {
        console.error("❌ Error en la lógica principal:", error);
        await twilioService.sendWhatsAppMessage(from, `❌ Hubo un problema procesando tu solicitud.`);
    }
    
    res.status(200).send();
});

module.exports = router;