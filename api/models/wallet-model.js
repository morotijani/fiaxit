const { Sequelize, DataTypes } = require('sequelize');
const db = require('./db');

const Wallet = db.define('fiaxit_wallets', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    wallet_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
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
        allowNull: false
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW
    }
}, {
    indexes: [
        { fields: ['wallet_for'] },
        { fields: ['wallet_crypto_name'] },
        { fields: ['createdAt'] },
        { fields: ['wallet_status'] }
    ],
    timestamps: true, // Enable timestamps
    paranoid: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    tableName: 'fiaxit_wallets',
    engine: 'InnoDB',
    charset: 'utf8',
    collate: 'utf8_general_ci',
});

// Use { force: false, alter: true } for safer migrations in development
const syncOptions = process.env.NODE_ENV === 'development'
    ? { alter: true }
    : { force: false };

Wallet.sync(syncOptions)
    .then(() => console.log('Fiaxit Wallet table synced.'))
    .catch(err => console.error('Fiaxit Wallet table sync error:', err));

module.exports = Wallet;