const { Sequelize, DataTypes } = require('sequelize');
const mysql = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    pool: {
        min: 0,
        max: 5
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false // Only log in development
});

const Transaction = mysql.define('fiaxit_transactions', {
    transaction_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    transaction_by: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    transaction_amount: {
        type: DataTypes.DECIMAL(15, 8), // DECIMAL is better for financial data than DOUBLE
        allowNull: false
    },
    transaction_crypto_id: {
        type: DataTypes.STRING(255),
        allowNull: true // Explicitly mark as nullable
    },
    transaction_crypto_symbol: {
        type: DataTypes.STRING(50),
        allowNull: true
    }, 
    transaction_crypto_name: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    transaction_crypto_price: {
        type: DataTypes.DECIMAL(20, 8), // DECIMAL for price with high precision
        allowNull: true
    }, 
    transaction_to_wallet_address: {
        type: DataTypes.STRING(300),
        allowNull: false // Assuming this is required
    }, 
    transaction_message: {
        type: DataTypes.STRING(500),
        allowNull: true
    }, 
    transaction_status: {
        type: DataTypes.TINYINT(1), // Use TINYINT(1) for boolean-like fields
        defaultValue: 0,
        allowNull: false,
        validate: {
            isIn: [[0, 1, 2, 3]] // Add validation for allowed status values
        }
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW
    }
}, {
    indexes: [
        {fields: ['transaction_id']},
        {fields: ['transaction_by']},
        {fields: ['transaction_to_wallet_address']},
        {fields: ['transaction_status']}
    ],
    timestamps: true, // Enable timestamps
    // underscored: true, // Use snake_case for auto-generated fields
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

// Use { force: false, alter: true } for safer migrations in development
const syncOptions = process.env.NODE_ENV === 'development' 
    ? { alter: true } 
    : { force: false };

Transaction.sync(syncOptions)
    .then(() => console.log('Transaction model synchronized'))
    .catch(err => console.error('Error synchronizing Transaction model:', err));

module.exports = Transaction;
