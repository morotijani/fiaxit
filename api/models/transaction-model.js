const { Sequelize, DataTypes } = require('sequelize');
const db = require('./db');
const User = require('./user-model');

const Transaction = db.define('fiaxit_transactions', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    transaction_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    transaction_hash_id: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    transaction_by: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    transaction_to: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    transaction_amount: {
        type: DataTypes.DECIMAL(15, 8), // DECIMAL is better for financial data than DOUBLE
        allowNull: false
    },
    transaction_amount_usd: {
        type: DataTypes.DECIMAL(20, 2), // USD value at time of transaction
        allowNull: true
    },
    transaction_type: {
        type: DataTypes.ENUM('send', 'receive'),
        defaultValue: null,
        allowNull: true
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
    transaction_from_wallet_address: {
        type: DataTypes.STRING(300),
        allowNull: false // Assuming this is required
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
        type: DataTypes.ENUM('Completed', 'Pending', 'Failed', 'Cancelled'), // Use TINYINT(1) for boolean-like fields
        defaultValue: 'Pending',
        allowNull: false,
        validate: {
            isIn: [['Completed', 'Pending', 'Failed', 'Cancelled']] // Add validation for allowed status values
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
        { fields: ['transaction_by'] },
        { fields: ['transaction_to_wallet_address'] },
        { fields: ['transaction_status'] }
    ],
    timestamps: true, // Enable timestamps
    paranoid: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    tableName: 'fiaxit_transactions',
    engine: 'InnoDB',
    charset: 'utf8',
    collate: 'utf8_general_ci',
});

// Associations
Transaction.belongsTo(User, { as: 'sender', foreignKey: 'transaction_by', targetKey: 'user_id' });
User.hasMany(Transaction, { foreignKey: 'transaction_by', sourceKey: 'user_id' });

// Sync Options
const syncOptions = process.env.NODE_ENV === 'development'
    ? { alter: true }
    : { force: false };

Transaction.sync(syncOptions)
    .then(() => console.log('Transaction model synchronized'))
    .catch(err => console.error('Error synchronizing Transaction model:', err));

module.exports = Transaction;