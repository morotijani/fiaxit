const { Sequelize, DataTypes } = require('sequelize');
const mysql = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST, 
    dialect: process.env.DB_DIALECT, 
    pool: { // instead of closing database connection every time it opens when it runs a query, it will keep a pool of conections open and ready so once it connects it will keep it open when it is done and future queries that come in will use those open connection
        min: 0, 
        max: 5
    }
})

const Contact = mysql.define('Contact', {
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
    email : {
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
        {fields: ['user_id']}
    ]
})

Contact.sync();
module.exports = Contact;