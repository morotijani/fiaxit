// user forget password model
const { Sequelize, DataTypes } = require('sequelize')
const { v4: uuidv4 } = require('uuid') 
const mysql = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST, 
    dialect: process.env.DB_DIALET, 
    pool: {
        max: 5, 
        min: 0, 
        // idle: 10000
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
        unique: true
    }, 
    password_reset_user_id: {
        type: DataTypes.STRING(255), 
        allowNull: false, 
    }, 
    password_reset_token: {
        type: DataTypes.STRING(10), 
        allowNull: false, 
    }, 
    password_reset_is_used: {
        type: DataTypes.BOOLEAN, 
        allowNull: false, 
        defaultValue: false
    }, 
    createdAt: {
        type: DataTypes.DATE, 
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'), 
        allowNull: false
    }, 
    updatedAt: {
        type: DataTypes.DATE, 
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'), 
    }
}, {
    indexes: [
        {
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
    tableName: 'fiaxit_user_forget_password', 
    charset: 'utf8', 
    collate: 'utf8_general_ci', 
})

const syncOptions = process.env.NODE_ENV === 'development' ? { alter: true } : { force: false }

UserForgetPassword.sync(syncOptions)
    .then(() => console.log('Fiaxit UserForgetPassword table synced.'))
    .catch(err => console.error('Fiaxit UserForgetPassword table sync error:', err));

UserForgetPassword.beforceCreate(async (forgetPassword, options) => {
    const unique_id = uuidv4()
    forgetPassword.password_reset_id = unique_id
    // forgetPassword.password_reset_token = unique_id
    // forgetPassword.password_reset_is_used = false
})


module.exports = UserForgetPassword;