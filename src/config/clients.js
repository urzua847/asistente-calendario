// src/config/clients.js
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { google } = require('googleapis');
const twilio = require('twilio');
const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

console.log("✅ Clientes (Firebase, Twilio, Google, Gemini) inicializados.");

module.exports = {
    db,
    twilioClient,
    oauth2Client,
    model
};