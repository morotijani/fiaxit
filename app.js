const express = require('express');
const app = express();
const router = express.Router(); // middleware
const contactRoutes = require('./api/routes/contacts')
const todoRoutes = require('./api/routes/todos')
const userRoutes = require('./api/routes/users')
const morgan = require('morgan') // HTTP request logger middleware for node.js
const bodyParser = require('body-parser')

app.use(morgan('dev'));

// any request pass through and handle urlencoded
app.use(bodyParser.urlencoded({extended:false})) // allows us to do the id and get parameter
app.use(bodyParser.json()) //

// CORS error handling
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    // methods that are allow to make requests
    if (req.method == 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'POST, PATCH, DELETE, GET')
        return res.status(200).json({})
    }
    next();
})

// Routes
app.use('/contacts', contactRoutes)
app.use('/todos', todoRoutes)
app.use('/users', userRoutes)

// Error handling
app.use((req, res, next) => {
    const error = new Error('Route not found.');
    error.status = 404;
    next(error)
})

// becuase is comming from next we have error first
app.use((error, req, res, next) => {
    res.status(error.status || 500); // or server erro
    res.json({
        error: {
            message: error.message
        }
    })
})

module.exports = app;