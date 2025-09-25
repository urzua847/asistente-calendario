// src/services/dbService.js
const { db } = require('../config/clients');

async function getUser(whatsappNumber) {
    const userRef = db.collection('users').doc(whatsappNumber);
    return await userRef.get();
}

async function saveUserTokens(whatsappNumber, tokens) {
    const userRef = db.collection('users').doc(whatsappNumber);
    await userRef.set({
        refreshToken: tokens.refresh_token,
        lastUpdated: new Date()
    }, { merge: true }); // Usamos merge para no borrar otros campos
    console.log(`✅ Tokens guardados en Firestore para ${whatsappNumber}`);
}

// --- NUEVA FUNCIÓN ---
async function saveLastEventId(whatsappNumber, eventId) {
    const userRef = db.collection('users').doc(whatsappNumber);
    // Guardamos el ID del último evento creado por este usuario
    await userRef.set({
        lastEventId: eventId
    }, { merge: true }); // merge: true evita que borremos el refreshToken
    console.log(`✅ Guardado el ID del último evento: ${eventId}`);
}

module.exports = { getUser, saveUserTokens, saveLastEventId };