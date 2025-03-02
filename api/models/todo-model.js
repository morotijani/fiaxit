const { Sequelize, DataTypes } = require('sequelize');
const mysql = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST, 
    dialect: process.env.DB_DIALECT, 
    pool: { // instead of closing database connection every time it opens when it runs a query, it will keep a pool of conections open and ready so once it connects it will keep it open when it is done and future queries that come in will use those open connection
        min: 0, 
        max: 5
    }
})

const Todo = mysql.define('Todo', {
    // there is not need to add id, mysql will add id by default as a primary key
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    name: {
        type: DataTypes.STRING,
        validate: {
            len: {
                msg: "Name must be between 2 and 255 characters.",
                args: [2, 255]
            }
        }
    },
    completed: {
        type: DataTypes.BOOLEAN,
        default: false
    }
}, {
    indexes: [
        {fields: ['user_id']}, 
        {fields: ['user_id', 'completed']}
    ]
})

Todo.sync(); // sync into our database;
module.exports = Todo;