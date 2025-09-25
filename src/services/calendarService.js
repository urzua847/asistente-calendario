// src/services/calendarService.js
const { google } = require('googleapis');
const { oauth2Client } = require('../config/clients');
const { formatDateAsLocalISO } = require('../utils/dateFormatter');

async function createCalendarEvent(tokens, eventDetails) {
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    let endTime;
    if (eventDetails.endTime) {
        endTime = eventDetails.endTime;
    } else {
        const startDate = new Date(eventDetails.startTime);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        endTime = formatDateAsLocalISO(endDate);
    }
    const event = {
        summary: eventDetails.title,
        location: eventDetails.location,
        description: eventDetails.description,
        start: { dateTime: eventDetails.startTime, timeZone: 'America/Santiago' },
        end: { dateTime: endTime, timeZone: 'America/Santiago' },
        recurrence: eventDetails.recurrenceRule ? [eventDetails.recurrenceRule] : []
    };
    try {
        const res = await calendar.events.insert({ calendarId: 'primary', resource: event });
        console.log('✅ Evento creado con éxito: %s', res.data.htmlLink);
        return res.data;
    } catch (error) {
        console.error('❌ Error al crear el evento en el calendario:', error.response?.data?.error || error.message);
        return null;
    }
}

async function editCalendarEvent(tokens, eventId, eventUpdates) {
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const resourceToUpdate = {};
    if (eventUpdates.title) resourceToUpdate.summary = eventUpdates.title;
    if (eventUpdates.location) resourceToUpdate.location = eventUpdates.location;
    if (eventUpdates.description) resourceToUpdate.description = eventUpdates.description;
    if (eventUpdates.startTime) resourceToUpdate.start = { dateTime: eventUpdates.startTime, timeZone: 'America/Santiago' };
    if (eventUpdates.endTime) resourceToUpdate.end = { dateTime: eventUpdates.endTime, timeZone: 'America/Santiago' };
    if (eventUpdates.startTime && !eventUpdates.endTime) {
        const newStartDate = new Date(eventUpdates.startTime);
        const newEndDate = new Date(newStartDate.getTime() + 60 * 60 * 1000);
        resourceToUpdate.end = { dateTime: formatDateAsLocalISO(newEndDate), timeZone: 'America/Santiago' };
    }
    try {
        const res = await calendar.events.patch({
            calendarId: 'primary',
            eventId: eventId,
            resource: resourceToUpdate
        });
        console.log('✅ Evento editado con éxito: %s', res.data.htmlLink);
        return res.data;
    } catch (error) {
        console.error('❌ Error al editar el evento en el calendario:', error.response?.data?.error || error.message);
        return null;
    }
}

async function deleteCalendarEvent(tokens, eventId) {
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    try {
        await calendar.events.delete({ calendarId: 'primary', eventId: eventId });
        console.log('✅ Evento eliminado con éxito.');
        return true;
    } catch (error) {
        console.error('❌ Error al eliminar el evento del calendario:', error.response?.data?.error || error.message);
        return false;
    }
}

async function getCalendarEvents(tokens, timeMin, timeMax) {
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    try {
        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin,
            timeMax: timeMax,
            maxResults: 15,
            singleEvents: true,
            orderBy: 'startTime',
        });
        return res.data.items || [];
    } catch (error) {
        console.error('❌ Error al leer los eventos del calendario:', error.response?.data?.error || error.message);
        return null;
    }
}

// --- NUEVA FUNCIÓN AÑADIDA ---
async function getSingleEvent(tokens, eventId) {
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    try {
        const res = await calendar.events.get({
            calendarId: 'primary',
            eventId: eventId,
        });
        return res.data;
    } catch (error) {
        console.error('❌ Error al obtener el evento individual:', error);
        return null;
    }
}

module.exports = { createCalendarEvent, editCalendarEvent, deleteCalendarEvent, getCalendarEvents, getSingleEvent };