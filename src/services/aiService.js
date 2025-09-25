// src/services/aiService.js
const { model } = require('../config/clients');

async function extractEventDetails(text, context = null) {
    const currentDate = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });
    
    // El prompt base ahora es más dinámico
    let basePrompt = `
        Tu tarea es ser un asistente experto en Google Calendar. Analiza la información para clasificar la intención y extraer los detalles.
        La fecha y hora actual de referencia es: ${currentDate}. La zona horaria es America/Santiago.

        ### REGLAS DE CLASIFICACIÓN DE INTENCIÓN ("intent"): "create", "edit", "delete", "query", "other".
        ### REGLAS DE EXTRACCIÓN ("details"):
        - Para "create" o "edit": Extrae un objeto con los detalles del evento (title, startTime, endTime, location, description, recurrenceRule).
        - Para "query": Extrae un objeto con "timeMin" y "timeMax".
        - Para "delete" u "other": "details" puede ser un objeto vacío {}.
    `;

    // --- CAMBIO CLAVE: AÑADIMOS EL CONTEXTO AL PROMPT SI EXISTE ---
    if (context && context.intent === 'edit' && context.originalEvent) {
        basePrompt += `
            CONTEXTO: El usuario quiere editar el siguiente evento que ya existe en su calendario:
            ${JSON.stringify(context.originalEvent)}

            INSTRUCCIÓN DEL USUARIO PARA LA EDICIÓN: "${text}"

            Tu tarea es fusionar la instrucción del usuario con el evento del contexto para generar los detalles COMPLETOS Y ACTUALIZADOS del evento.
            Por ejemplo, si el usuario solo dice "a las 4pm", debes mantener el título y la fecha originales y solo cambiar la hora.
            Si dice "no, el título es 'Reunión Final'", debes mantener la fecha y hora y solo cambiar el título.
            El objeto "details" que generes debe contener la versión final y completa del evento.
        `;
    } else {
        basePrompt += `Texto del usuario: "${text}"`;
    }

    basePrompt += `\nResponde únicamente con un objeto JSON con las claves "intent" y "details".`;
    
    try {
        const result = await model.generateContent(basePrompt);
        const response = await result.response;
        const cleanedText = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        console.log("Respuesta de la IA (con Memoria):", cleanedText);
        return JSON.parse(cleanedText);
    } catch (error) {
        console.error("❌ Error al procesar la respuesta de Gemini:", error);
        return { intent: "error", details: {} };
    }
}

module.exports = { extractEventDetails };