const express = require('express');
const app = express();
const contactRoutes = require('./api/routes/contacts');
const todoRoutes = require('./api/routes/todos');
const authRoutes = require('./api/routes/auth');
const userRoutes = require('./api/routes/users');
const transactionRoutes = require('./api/routes/transactions');
const walletRoutes = require('./api/routes/wallets');
const tradeRoutes = require('./api/routes/trade');
const coverterRoutes = require('./api/routes/convert');
const coinRoutes = require('./api/routes/coins');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const { authenticate } = require('./api/middleware/check-auth');

app.use(morgan('dev'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// CORS error handling
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method == 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'POST, PATCH, DELETE, GET');
        return res.status(200).json({});
    }
    next();
});

// Routes
app.use('/v1/contacts', contactRoutes);
app.use('/v1/todos', todoRoutes);
app.use('/v1/auth', authRoutes);
app.use('/v1/user', userRoutes);
app.use('/v1/wallets', authenticate, walletRoutes);
app.use('/v1/transactions', authenticate, transactionRoutes);
app.use('/v1/trade', authenticate, tradeRoutes);
app.use('/v1/convert', coverterRoutes);
app.use('/v1/coins', coinRoutes);

// Error handling
app.use((req, res, next) => {
    const error = new Error('Route not found.');
    error.status = 404;
    next(error);
});

app.use((error, req, res, next) => {
    res.status(error.status || 500);
    res.json({
        error: {
            message: error.message
        }
    });
});

module.exports = app;