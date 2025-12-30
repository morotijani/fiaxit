const { Sequelize, DataTypes } = require('sequelize')
const { v4: uuidv4 } = require('uuid')
const db = require('./db');

const UserForgetPassword = db.define('fiaxit_user_forget_password', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    password_reset_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    password_reset_user_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    password_reset_token: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    password_reset_expires: {
        type: DataTypes.DATE
    },
    password_reset_is_used: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW
    }
}, {
    indexes: [
        {
            fields: ['password_reset_user_id']
        },
        {
            fields: ['password_reset_token']
        },
        {
            fields: ['password_reset_is_used']
        },
        {
            fields: ['createdAt']
        }
    ],
    timestamps: true,
    paranoid: true,
    // underscored: true, // Use snake_case for auto-generated fields
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    tableName: 'fiaxit_user_forget_password',
    engine: 'InnoDB',
    charset: 'utf8',
    collate: 'utf8_general_ci',
})

const syncOptions = process.env.NODE_ENV === 'development' ? { alter: true } : { force: false }

UserForgetPassword.sync(syncOptions)
    .then(() => console.log('Fiaxit UserForgetPassword table synced.'))
    .catch(err => console.error('Fiaxit UserForgetPassword table sync error:', err));

UserForgetPassword.beforeCreate(async (forgetPassword, options) => {
    const unique_id = uuidv4()
    forgetPassword.password_reset_id = unique_id
    // forgetPassword.password_reset_token = unique_id
    // forgetPassword.password_reset_is_used = false
})


module.exports = UserForgetPassword;