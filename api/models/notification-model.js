const { Sequelize, DataTypes } = require('sequelize');
const db = require('./db');

const Notification = db.define('fiaxit_notifications', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('info', 'success', 'warning', 'error'),
        defaultValue: 'info'
    },
    is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    link: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    source_id: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    source_type: {
        type: DataTypes.STRING(100),
        allowNull: true
    }
}, {
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ['user_id'] },
        { fields: ['is_read'] },
        { fields: ['createdAt'] }
    ]
});

// Sync the model
const syncOptions = process.env.NODE_ENV === 'development' ? { alter: true } : { force: false };
Notification.sync(syncOptions)
    .then(() => console.log('Notification model synchronized'))
    .catch(err => console.error('Error synchronizing Notification model:', err));

module.exports = Notification;
