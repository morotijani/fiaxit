const { Sequelize, DataTypes } = require('sequelize');
const db = require('./db');

const PriceAlert = db.define('fiaxit_price_alerts', {
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
    target_price: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false
    },
    direction: {
        type: DataTypes.ENUM('above', 'below'),
        allowNull: false
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    triggered_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    indexes: [
        { fields: ['user_id'] },
        { fields: ['coin_symbol'] },
        { fields: ['is_active'] }
    ],
    tableName: 'fiaxit_price_alerts'
});

const syncOptions = process.env.NODE_ENV === 'development'
    ? { alter: true }
    : { force: false };

PriceAlert.sync(syncOptions)
    .then(() => console.log('PriceAlert model synchronized'))
    .catch(err => console.error('Error synchronizing PriceAlert model:', err));

module.exports = PriceAlert;
