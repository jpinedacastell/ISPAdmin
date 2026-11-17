const pool = require('../config/database');

async function emailAceptaNull() {
    const [columnas] = await pool.query(`
        SELECT IS_NULLABLE
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'clientes'
          AND COLUMN_NAME = 'email'
    `);
    return columnas[0].IS_NULLABLE === 'YES';
}

exports.up = async () => {
    try {
        if (!(await emailAceptaNull())) {
            await pool.query('ALTER TABLE clientes MODIFY email VARCHAR(100) NULL DEFAULT NULL');
        }
        // Correos vacíos pasan a NULL para no chocar con el índice UNIQUE
        await pool.query("UPDATE clientes SET email = NULL WHERE TRIM(email) = ''");

        console.log('Migración 006_clientes_email_opcional completada');
    } catch (error) {
        console.error('Error en migración 006_clientes_email_opcional:', error);
        throw error;
    }
};

exports.down = async () => {
    try {
        const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM clientes WHERE email IS NULL');
        if (total > 0) {
            throw new Error(`Hay ${total} clientes sin email; asigne uno antes de revertir`);
        }
        if (await emailAceptaNull()) {
            await pool.query('ALTER TABLE clientes MODIFY email VARCHAR(100) NOT NULL');
        }

        console.log('Rollback de 006_clientes_email_opcional completado');
    } catch (error) {
        console.error('Error en rollback 006_clientes_email_opcional:', error);
        throw error;
    }
};
