const { DataTypes } = require('sequelize');
const db = require('./db');

const Contact = db.define('fiaxit_contacts', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    fname: {
        type: DataTypes.STRING
    },
    lname: {
        type: DataTypes.STRING
    },
    email: {
        type: DataTypes.STRING(155)
    },
    phone: {
        type: DataTypes.STRING(55)
    },
    nickname: {
        type: DataTypes.STRING,
        allowNull: true
    },
    wallet_address: {
        type: DataTypes.STRING(300),
        allowNull: true
    },
    coin_symbol: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    message: {
        type: DataTypes.STRING(500),
        allowNull: true,
        validate: {
            len: {
                msg: "Message content cannot be more than 500 words.",
                args: [1, 500]
            }
        }
    }
}, {
    indexes: [
        { fields: ['user_id'] }
    ],
    tableName: 'fiaxit_contacts',
    engine: 'InnoDB',
    charset: 'utf8',
    collate: 'utf8_general_ci',
})

const syncOptions = process.env.NODE_ENV === 'development'
    ? { alter: true }
    : { force: false };

Contact.sync(syncOptions);
module.exports = Contact;