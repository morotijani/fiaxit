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

const Wallet = mysql.define('fiaxit_wallets', {
    wallet_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    wallet_name: {
        type: DataTypes.STRING(150), 
        allowNull: false
    }, 
    wallet_for: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    wallet_symbol: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    wallet_crypto_name: {
        type: DataTypes.STRING(150),
        allowNull: false
    }, 
    wallet_xpub: {
        type: DataTypes.STRING(300),
    }, 
    wallet_address: {
        type: DataTypes.STRING(300),
        allowNull: false
    }, 
    wallet_privatekey: {
        type: DataTypes.STRING(),
        allowNull: false
    }, 
    wallet_mnemonic: {
        type: DataTypes.STRING(),
    }, 
    wallet_status: {
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
        {fields: ['wallet_id']},
        {fields: ['wallet_for']},
        {fields: ['wallet_crypto_name']}, 
        {fields: ['createdAt']}, 
        {fields: ['wallet_status']}
    ],
    timestamps: true, // Enable timestamps
    // underscored: true, // Use snake_case for auto-generated fields
    paranoid: true, 
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

// Use { force: false, alter: true } for safer migrations in development
const syncOptions = process.env.NODE_ENV === 'development' 
    ? { alter: true } 
    : { force: false };

Wallet.sync(syncOptions)
    .then(() => console.log('Wallet model synchronized'))
    .catch(err => console.error('Error synchronizing Wallet model:', err));

module.exports = Wallet;