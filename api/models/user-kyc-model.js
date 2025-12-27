const { Sequelize, DataTypes } = require('sequelize');
const db = require('./db');

const USERKYC = db.define('fiaxit_kyc', {
    kyc_id: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    kyc_for: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    kyc_id_type: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    kyc_id_number: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    kyc_document_front: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    kyc_document_back: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    kyc_selfie: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    kyc_address: {
        type: DataTypes.STRING,
        allowNull: false
    },
    kyc_street: {
        type: DataTypes.STRING,
        allowNull: false
    },
    kyc_city: {
        type: DataTypes.STRING,
        allowNull: false
    },
    kyc_state: {
        type: DataTypes.STRING,
    },
    kyc_postal_code: {
        type: DataTypes.STRING(100),
    },
    kyc_country: {
        type: DataTypes.STRING,
        allowNull: false
    },
    kyc_status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
        allowNull: false
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
        { fields: ['kyc_id'] },
        { fields: ['kyc_for'] },
        { fields: ['kyc_id_type'] },
        { fields: ['kyc_id_number'] },
        { fields: ['kyc_status'] },
        { fields: ['createdAt'] }
    ],
    timestamps: true, // Enable timestamps
    // underscored: true, // Use snake_case for auto-generated fields
    paranoid: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    tableName: 'fiaxit_kyc',
    charset: 'utf8',
    collate: 'utf8_general_ci',
});

// Use { force: false, alter: true } for safer migrations in development
const syncOptions = process.env.NODE_ENV === 'development'
    ? { alter: true }
    : { force: false };

// Sync the model with the database
USERKYC.sync(syncOptions)
    .then(() => console.log('USERKYC model synchronized'))
    .catch(err => console.error('Error synchronizing USERKYC model:', err));

module.exports = USERKYC;