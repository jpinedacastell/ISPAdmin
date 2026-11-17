const db = require('../config/database');

async function updateClientesTable() {
    let connection;
    try {
        connection = await db.getConnection();
        
        // Verificar si la columna ya existe
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'clientes' 
            AND COLUMN_NAME = 'dni'
        `);

        if (columns.length === 0) {
            // Agregar la columna dni
            await connection.query(`
                ALTER TABLE clientes 
                ADD COLUMN dni VARCHAR(20) UNIQUE AFTER id
            `);
            console.log('✅ Columna "dni" agregada correctamente a la tabla clientes');
        } else {
            console.log('ℹ️ La columna "dni" ya existe en la tabla clientes');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error al actualizar la tabla clientes:', error);
        process.exit(1);
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

updateClientesTable(); 