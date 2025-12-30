const { DataTypes } = require('sequelize');
const db = require('./db');

const Session = db.define('Session', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    session_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    user_id: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    device_name: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    last_active: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    is_current: {
        type: DataTypes.VIRTUAL // used for UI to flag the current session
    }
}, {
    tableName: 'fiaxit_sessions',
    timestamps: true
});

// Use { force: false, alter: true } for safer migrations in development
const syncOptions = process.env.NODE_ENV === 'development'
    ? { alter: true }
    : { force: false };

Session.sync(syncOptions)
    .then(() => console.log('Session model synchronized'))
    .catch(err => console.error('Error synchronizing session model:', err));

module.exports = Session;
