const { DataTypes } = require('sequelize');
const db = require('./db');

const Todo = db.define('fiaxit_todos', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
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
    ],
    tableName: 'fiaxit_todos',
    engine: 'InnoDB',
    charset: 'utf8',
    collate: 'utf8_general_ci',
})

const syncOptions = process.env.NODE_ENV === 'development'
    ? { alter: true }
    : { force: false };

Todo.sync(syncOptions);
module.exports = Todo;