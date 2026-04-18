// conexion a la base de datos
const mysql = require('mysql');

function getConnectionConfig() {
    if (process.env.DATABASE_URL) {
        try {
            const dbUrl = new URL(process.env.DATABASE_URL);
            if (!dbUrl.hostname || dbUrl.hostname === 'localhost' || dbUrl.hostname === '127.0.0.1' || dbUrl.hostname === '::1') {
                console.warn('WARNING: DATABASE_URL is configured to use localhost. Render cannot connect to a local MySQL server. Use a remote MySQL host accessible from the internet.');
            }

            return {
                host: dbUrl.hostname,
                port: dbUrl.port ? Number(dbUrl.port) : 3300,
                user: dbUrl.username,
                password: dbUrl.password,
                database: dbUrl.pathname ? dbUrl.pathname.replace(/^\//, '') : undefined
            };
        } catch (error) {
            console.warn('DATABASE_URL parse error:', error.message);
        }
    }

    return {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || ''
    };
}

const connectionConfig = getConnectionConfig();
const connection = mysql.createConnection(connectionConfig);

connection.connect((error) => {
    if (error) {
        console.log('El error de conexion es: ', error);
        return;
    }
    console.log('Conectado a la base de datos MySQL');
});
module.exports = connection; // exportamos la conexion para usarla en otros archivos