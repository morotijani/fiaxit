const { DataTypes } = require('sequelize');
const db = require('./db');

const Todo = db.define('Todo', {
    // there is not need to add id, mysql will add id by default as a primary key
    user_id: {
        type: DataTypes.STRING(100),
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
        { fields: ['user_id'] },
        { fields: ['user_id', 'completed'] }
    ]
})

Todo.sync(); // sync into our database;
module.exports = Todo;