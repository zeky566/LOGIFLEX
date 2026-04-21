// conexion a la base de datos usando variables de entorno
const mysql = require('mysql2');
require('dotenv').config({ path: './env/.env' });

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306
});

connection.connect((error) => {
    if (error) {
        console.log('El error de conexion es: ', error);
        return;
    }
    console.log('Conectado a la base de datos MySQL');
});

module.exports = connection;