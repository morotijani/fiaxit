const { Sequelize, DataTypes } = require('sequelize');
const db = require('./db');

const Staking = db.define('fiaxit_stakings', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    staking_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    user_id: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    coin_symbol: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'USDT'
    },
    amount: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false
    },
    interest_rate: {
        type: DataTypes.DECIMAL(5, 2), // e.g., 5.00 for 5%
        allowNull: false
    },
    duration_days: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('active', 'completed', 'cancelled'),
        defaultValue: 'active'
    },
    start_date: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW
    },
    end_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    interest_earned: {
        type: DataTypes.DECIMAL(20, 8),
        defaultValue: 0
    }
}, {
    indexes: [
        { fields: ['user_id'] },
        { fields: ['status'] }
    ],
    tableName: 'fiaxit_stakings',
    timestamps: true,
    engine: 'InnoDB',
    charset: 'utf8',
    collate: 'utf8_general_ci',
});

const syncOptions = process.env.NODE_ENV === 'development'
    ? { alter: true }
    : { force: false };

Staking.sync(syncOptions)
    .then(() => console.log('Staking model synchronized'))
    .catch(err => console.error('Error synchronizing Staking model:', err));

module.exports = Staking;
