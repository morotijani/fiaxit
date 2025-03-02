const express = require('express');
const app = express();
const router = express.Router(); // middleware

// set up route and tell it what to do
router.get('/', (req, res) => {
    res.send('Hello World');
});

router.get('/about', (req, res) => {
    res.send('About us');
});

router.get('/contact', (req, res) => {
    res.send('Contact us');
});

app.use(router);

module.exports = app;