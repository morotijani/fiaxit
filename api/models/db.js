const { Sequelize } = require('sequelize');
const path = require('path');

const dialect = process.env.DB_DIALECT || 'sqlite';
const storage = process.env.DB_STORAGE || path.join(__dirname, '../../database.sqlite');

let sequelize;

if (dialect === 'sqlite') {
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: storage,
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 5,
            min: 0,
            idle: 10000
        }
    });
} else {
    sequelize = new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASSWORD,
        {
            host: process.env.DB_HOST || 'localhost',
            dialect: dialect,
            logging: process.env.NODE_ENV === 'development' ? console.log : false,
            pool: {
                max: 5,
                min: 0,
                idle: 10000
            }
        }
    );
}

sequelize.authenticate()
    .then(() => {
        console.log(`Connection to ${dialect} has been established successfully.`);
    })
    .catch(err => {
        console.error(`Unable to connect to the ${dialect} database:`, err);
    });

module.exports = sequelize;
