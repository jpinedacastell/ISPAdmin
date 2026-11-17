const db = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

async function setupFacturacion() {
    let connection;
    try {
        connection = await db.getConnection();
        
        console.log('Leyendo script SQL...');
        const sqlScript = await fs.readFile(
            path.join(__dirname, 'facturas_tables.sql'),
            'utf8'
        );

        console.log('Ejecutando script SQL...');
        const statements = sqlScript
            .split(';')
            .filter(statement => statement.trim());

        for (const statement of statements) {
            if (statement.trim()) {
                await connection.query(statement);
                console.log('Consulta ejecutada exitosamente');
            }
        }

        console.log('Configuración de facturación completada');
    } catch (error) {
        console.error('Error al configurar las tablas de facturación:', error);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

// Ejecutar la configuración
setupFacturacion().then(() => {
    console.log('Script completado');
    process.exit(0);
}).catch(error => {
    console.error('Error:', error);
    process.exit(1);
}); 