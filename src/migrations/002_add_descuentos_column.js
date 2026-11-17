const mysql = require('mysql2/promise');

async function up(db) {
    try {
        const [result] = await db.query(`
            ALTER TABLE facturas 
            ADD COLUMN descuentos JSON DEFAULT '[]' COMMENT 'Historial de descuentos aplicados'
        `);
        console.log('Columna descuentos agregada exitosamente');
        return result;
    } catch (error) {
        console.error('Error al agregar la columna descuentos:', error);
        throw error;
    }
}

async function down(db) {
    try {
        const [result] = await db.query(`
            ALTER TABLE facturas 
            DROP COLUMN descuentos
        `);
        console.log('Columna descuentos eliminada exitosamente');
        return result;
    } catch (error) {
        console.error('Error al eliminar la columna descuentos:', error);
        throw error;
    }
}

module.exports = { up, down };
