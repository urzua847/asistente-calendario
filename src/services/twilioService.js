// src/services/twilioService.js
const { twilioClient } = require('../config/clients');

async function sendWhatsAppMessage(to, message) {
    try {
        await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: to
        });
        console.log(`✅ Mensaje de WhatsApp enviado a ${to}`);
    } catch (error) {
        console.error(`❌ Error al enviar mensaje de WhatsApp a ${to}:`, error);
    }
}

module.exports = { sendWhatsAppMessage };