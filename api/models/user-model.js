const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const mysql = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST, 
    dialect: process.env.DB_DIALECT, 
    pool: { // instead of closing database connection every time it opens when it runs a query, it will keep a pool of conections open and ready so once it connects it will keep it open when it is done and future queries that come in will use those open connection
        min: 0, 
        max: 5
    }, 
    logging: process.env.NODE_ENV === 'development' ? console.log : false // Only log in development
})

const User = mysql.define('fiaxit_users', {
    user_id: {
        type: DataTypes.STRING(100),
        allowNull: false
    }, 
    user_fname: {
        type: DataTypes.STRING
    }, 
    user_mname: {
        type: DataTypes.STRING
    }, 
    user_lname: {
        type: DataTypes.STRING
    },
    user_email: {
        type: DataTypes.STRING(155),
        allowNull: false, 
        unique: true,
        validate: {
            isEmail: {
                msg: "Must be a valid email."
            }
        }
    }, 
    user_phone: {
        type: DataTypes.STRING(15)
    }, 
    user_password: {
        type: DataTypes.STRING(75), // we will hash the password in bcrypt so no matter how long your password it will 75 will hold
        allowNull: false, 
        validate: {
            len: {
                msg: "Password must be at least 8 characters.",
                args: [8, 255]
            }
        }
    }, 
    user_pin: {
        type: DataTypes.STRING(75), 
        allowNull: false, 
        validate: {
            len: {
                msg: "Pin must be 4 characters.",
                args: [4, 6]
            }
        }
    }, 
    user_invitationcode: {
        type: DataTypes.STRING(50)
    }, 
    createdAt: {
        type: DataTypes.DATE, 
        defaultValue: Sequelize.NOW
    }, 
    updatedAt: {
        type: DataTypes.DATE, 
        defaultValue: Sequelize.NOW
    }
}, {
    indexes: [
        {fields: ['user_id']}, 
        {fields: ['user_email']}, 
        {fields: ['user_phone']}, 
        {fields: ['createdAt']}
    ], 
    timestamps: true, 
    createdAt: 'createdAt', 
    updatedAt: 'updatedAt'
});

// Use { force: false, alter: true } for safer migrations in development
const syncOptions = process.env.NODE_ENV === 'development' 
    ? { alter: true } 
    : { force: false };

User.sync(syncOptions)
    .then(() => console.log('Fiaxit Users model synchronized'))
    .catch(err => console.error('Error synchronizing fiaxit users model:', err));
    
// this hook, run before user create
User.beforeCreate(async (user, options) => { // pass user object in this function
    const hashed = await bcrypt.hash(user.user_password, 10); // create a has password from user.password
    const pinHashed = await bcrypt.hash(user.user_pin, 10)
    user.user_password = hashed;
    user.user_pin = pinHashed
});

User.beforeSave(async (user, options) => {
    if (user.updatePassword) {
        const hashed = await bcrypt.hash(user.user_password, 10)
        user.user_password = hashed
    }

    if (user.updatePin) {
        const pinHashed = await bcrypt.hash(user.user_pin, 10)
        user.user_pin = pinHashed
    }
})

module.exports = User;