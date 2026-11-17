const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuración de la base de datos
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'c_isp',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true // Permitir múltiples consultas
});

// Función para probar la conexión
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conexión a la base de datos establecida correctamente');
        connection.release();
    } catch (error) {
        console.error('Error al conectar a la base de datos: ');
        console.error('Código de error:', error.code);
        console.error('Número de error:', error.errno);
        console.error('SQL Estado:', error.sqlState);
        console.error('Configuración usada:', {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            database: process.env.DB_NAME || 'c_isp'
        });
        throw error;
    }
}

// Exportar el pool y la función de prueba
module.exports = pool;
module.exports.testConnection = testConnection; 