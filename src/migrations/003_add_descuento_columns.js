const pool = require('../config/database');

exports.up = async () => {
    try {
        await pool.query(`
            ALTER TABLE facturas 
            ADD COLUMN descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
            ADD COLUMN descuento_monto DECIMAL(10,2) DEFAULT 0,
            ADD COLUMN motivo_descuento VARCHAR(255) DEFAULT NULL
        `);
        console.log('Columnas de descuento agregadas exitosamente');
    } catch (error) {
        console.error('Error al agregar columnas de descuento:', error);
        throw error;
    }
};

exports.down = async () => {
    try {
        await pool.query(`
            ALTER TABLE facturas 
            DROP COLUMN descuento_porcentaje,
            DROP COLUMN descuento_monto
        `);
        console.log('Columnas de descuento eliminadas exitosamente');
    } catch (error) {
        console.error('Error al eliminar columnas de descuento:', error);
        throw error;
    }
};
