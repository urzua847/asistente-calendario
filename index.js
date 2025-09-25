// index.js
const express = require('express');
const mainRoutes = require('./src/routes/mainRoutes');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', mainRoutes);

app.listen(port, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${port}`);
});