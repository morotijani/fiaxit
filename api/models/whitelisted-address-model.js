const { DataTypes } = require('sequelize');
const db = require('./db');

const WhitelistedAddress = db.define('WhitelistedAddress', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    address_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    user_id: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    coin_symbol: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    address: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    label: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    is_whitelisted: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    last_used: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'fiaxit_whitelisted_addresses',
    timestamps: true
});

// Use { force: false, alter: true } for safer migrations in development
const syncOptions = process.env.NODE_ENV === 'development'
    ? { alter: true }
    : { force: false };

WhitelistedAddress.sync(syncOptions)
    .then(() => console.log('WhitelistedAddress model synchronized'))
    .catch(err => console.error('Error synchronizing whitelisted address model:', err));

module.exports = WhitelistedAddress;
