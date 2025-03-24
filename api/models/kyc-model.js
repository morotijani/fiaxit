// KYC MODEL
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

const KYC = mysql.define('fiaxit_kyc', {
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
        allowNull: false
    }, 
    kyc_postalCode: {
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
        {fields: ['kyc_id']},
        {fields: ['kyc_for']},
        {fields: ['kyc_id_type']}, 
        {fields: ['kyc_id_number']}, 
        {fields: ['kyc_status']}, 
        {fields: ['createdAt']}
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
    .then(() => console.log('KYC model synchronized'))
    .catch(err => console.error('Error synchronizing KYC model:', err));

module.exports = KYC;