const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const Coin = sequelize.define('fiaxit_coins', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    coin_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    coin_name: {
        type: DataTypes.STRING(150),
        allowNull: false
    },
    coin_symbol: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    coin_type: {
        type: DataTypes.ENUM('BTC', 'ETH', 'ERC20', 'TRC20'),
        defaultValue: 'ERC20',
        allowNull: false
    },
    coin_contract_address: {
        type: DataTypes.STRING(300),
        allowNull: true
    },
    coin_network: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'mainnet'
    },
    coin_status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    coin_icon: {
        type: DataTypes.STRING(300),
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: sequelize.Sequelize.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: sequelize.Sequelize.NOW
    }
}, {
    indexes: [
        { fields: ['coin_status'] },
        { fields: ['coin_type'] }
    ],
    timestamps: true,
    paranoid: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    tableName: 'fiaxit_coins',
    engine: 'InnoDB',
    charset: 'utf8',
    collate: 'utf8_general_ci',
});

const syncOptions = process.env.NODE_ENV === 'development'
    ? { alter: true }
    : { force: false };

Coin.sync(syncOptions)
    .then(() => console.log('Coin model synchronized'))
    .catch(err => console.error('Error synchronizing Coin model:', err));

module.exports = Coin;
