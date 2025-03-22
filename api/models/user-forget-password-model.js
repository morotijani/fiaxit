// user forget password model
const { Sequelize, DataTypes } = require('sequelize')
const { v4: uuidv4 } = require('uuid') 
const mysql = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST, 
    dialect: process.env.DB_DIALECT, 
    pool: {
        max: 5, 
        min: 0, 
        idle: 10000 // specifies the maximum time, in milliseconds, that a connection can remain idle (unused) before being released back to the pool, preventing resource leaks
    }, 
    define: {
        timestamps: false
    }, 
    logging: process.env.NODE_ENV === 'development' ? console.log : false
})

const UserForgetPassword = mysql.define('fiaxit_user_forget_password', {
    password_reset_id: {
        type: DataTypes.STRING(255), 
        allowNull: false, 
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
            unique: true, 
            fields: ['password_reset_id']
        }, 
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