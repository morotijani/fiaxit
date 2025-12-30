const { Sequelize, DataTypes } = require('sequelize');
const db = require('./db');

const BalanceSnapshot = db.define('fiaxit_balance_snapshots', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    total_balance_usd: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false
    },
    snapshot_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
    }
}, {
    indexes: [
        { fields: ['user_id'] },
        { fields: ['snapshot_at'] }
    ],
    tableName: 'fiaxit_balance_snapshots',
    timestamps: false // We use snapshot_at instead
});

const syncOptions = process.env.NODE_ENV === 'development'
    ? { alter: true }
    : { force: false };

BalanceSnapshot.sync(syncOptions)
    .then(() => console.log('BalanceSnapshot model synchronized'))
    .catch(err => console.error('Error synchronizing BalanceSnapshot model:', err));

module.exports = BalanceSnapshot;
