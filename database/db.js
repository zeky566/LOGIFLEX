// conexion a la base de datos
const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'bzinscjqdg3tkhiskt2f-mysql.services.clever-cloud.com',
    user: 'u6ogy9115t1olmyq',
    password: 'qYk8E8KviWHM7Ok0M8y',
    database: 'bzinscjqdg3tkhiskt2f',
    port: 20107
});

connection.connect((error) => {
    if (error) {
        console.log('El error de conexion es: ', error);
        return;
    }
    console.log('Conectado a la base de datos MySQL');
});
module.exports = connection;

connection.connect((error) => {
    if (error) {
        console.log('El error de conexion es: ', error);
        return;
    }
    console.log('Conectado a la base de datos MySQL');
});
module.exports = connection; // exportamos la conexion para usarla en otros archivos