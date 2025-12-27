const db = require('./db');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

const User = db.define('fiaxit_users', {
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
        // unique: true,
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
    user_vericode: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    user_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    user_invitationcode: {
        type: DataTypes.STRING(50)
    },
    user_role: {
        type: DataTypes.ENUM('user', 'admin'),
        defaultValue: 'user'
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
        { fields: ['user_id'] },
        { unique: true, fields: ['user_email'] },
        { fields: ['user_phone'] },
        { fields: ['createdAt'] }
    ],
    timestamps: true,
    paranoid: true,
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