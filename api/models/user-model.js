const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const mysql = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST, 
    dialect: process.env.DB_DIALECT, 
    pool: { // instead of closing database connection every time it opens when it runs a query, it will keep a pool of conections open and ready so once it connects it will keep it open when it is done and future queries that come in will use those open connection
        min: 0, 
        max: 5
    }
})

const User = mysql.define('User', {
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
        type: DataTypes.STRING(155),
        unique: true,
        validate: {
            isEmail: {
                msg: "Must be a valid email."
            }
        }
    }, 
    password: {
        type: DataTypes.STRING(75), // we will hash the password in bcrypt so no matter how long your password it will 75 will hold
        validate: {
            len: {
                msg: "Password must be at least 8 characters.",
                args: [8, 255]
            }
        }
    }
}, {
    indexes: [
        {fields: ['user_id']}, 
        {fields: ['email']}
    ]
});

User.sync();

// this hook, run before user create
User.beforeCreate(async (user, options) => { // pass user object in this function
    const hashed = await bcrypt.hash(user.password, 10); // create a has password from user.password
    user.password = hashed;
});

User.beforeSave(async (user, options) => {
    if (user.updatePassword) {
        const hashed = await bcrypt.hash(user.password, 10)
        user.password = hashed
    }
})

module.exports = User;