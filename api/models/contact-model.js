const { DataTypes } = require('sequelize');
const db = require('./db');

const Contact = db.define('Contact', {
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
    message: {
        type: DataTypes.STRING(500),
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
    ]
})

Contact.sync();
module.exports = Contact;