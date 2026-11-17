const db = require('../config/database');

async function updatePlanesTable() {
    try {
        // Verificar si la columna ya existe
        const [columns] = await db.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'planes' 
            AND COLUMN_NAME = 'activo'
        `);

        if (columns.length === 0) {
            // Agregar la columna activo
            await db.query(`
                ALTER TABLE planes 
                ADD COLUMN activo BOOLEAN DEFAULT true
            `);
            console.log('✅ Columna "activo" agregada correctamente a la tabla planes');

            // Actualizar registros existentes
            await db.query(`
                UPDATE planes 
                SET activo = true 
                WHERE activo IS NULL
            `);
            console.log('✅ Registros existentes actualizados correctamente');
        } else {
            console.log('ℹ️ La columna "activo" ya existe en la tabla planes');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error al actualizar la tabla planes:', error);
        process.exit(1);
    }
}

updatePlanesTable(); 