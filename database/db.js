// conexion a la base de datos
const mysql = require('mysql');

const connectionConfig = process.env.DATABASE_URL
    ? process.env.DATABASE_URL
    : {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE
    };

const connection = mysql.createConnection(connectionConfig);

connection.connect((error) => {
    if (error) {
        console.log('El error de conexion es: ', error);
        return;
    }
    console.log('Conectado a la base de datos MySQL');
});
module.exports = connection; // exportamos la conexion para usarla en otros archivos