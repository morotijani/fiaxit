const { Sequelize, DataTypes } = require('sequelize');
const db = require('./db');

const UserBalance = db.define('fiaxit_user_balances', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    coin_symbol: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    balance: {
        type: DataTypes.DECIMAL(20, 8),
        defaultValue: 0,
        allowNull: false
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW
    }
}, {
    indexes: [
        { unique: true, fields: ['user_id', 'coin_symbol'] }
    ],
    tableName: 'fiaxit_user_balances',
    timestamps: true,
    engine: 'InnoDB',
    charset: 'utf8',
    collate: 'utf8_general_ci',
});

const syncOptions = process.env.NODE_ENV === 'development'
    ? { alter: true }
    : { force: false };

UserBalance.sync(syncOptions)
    .then(() => console.log('UserBalance model synchronized'))
    .catch(err => console.error('Error synchronizing UserBalance model:', err));

module.exports = UserBalance;
