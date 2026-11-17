const pool = require('../config/database');

exports.up = async () => {
    try {
        // 1) Agregar columna si no existe
        const [columnas] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'tickets'
              AND COLUMN_NAME = 'codigo_ticket'
        `);

        if (columnas[0].total === 0) {
            await pool.query(`
                ALTER TABLE tickets
                ADD COLUMN codigo_ticket VARCHAR(25) NULL
            `);
        }

        // 2) Backfill para registros existentes
        await pool.query(`
            UPDATE tickets
            SET codigo_ticket = CONCAT(
                'TCK-',
                DATE_FORMAT(created_at, '%Y%m'),
                '-',
                LPAD(id, 5, '0')
            )
            WHERE codigo_ticket IS NULL OR codigo_ticket = ''
        `);

        // 3) Crear índice único si no existe
        const [idx] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'tickets'
              AND INDEX_NAME = 'ux_tickets_codigo_ticket'
        `);

        if (idx[0].total === 0) {
            await pool.query(`
                ALTER TABLE tickets
                ADD UNIQUE KEY ux_tickets_codigo_ticket (codigo_ticket)
            `);
        }

        console.log('Migración 004_add_ticket_codigo completada');
    } catch (error) {
        console.error('Error en migración 004_add_ticket_codigo:', error);
        throw error;
    }
};

exports.down = async () => {
    try {
        const [idx] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'tickets'
              AND INDEX_NAME = 'ux_tickets_codigo_ticket'
        `);
        if (idx[0].total > 0) {
            await pool.query(`
                ALTER TABLE tickets
                DROP INDEX ux_tickets_codigo_ticket
            `);
        }

        const [columnas] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'tickets'
              AND COLUMN_NAME = 'codigo_ticket'
        `);
        if (columnas[0].total > 0) {
            await pool.query(`
                ALTER TABLE tickets
                DROP COLUMN codigo_ticket
            `);
        }

        console.log('Rollback de 004_add_ticket_codigo completado');
    } catch (error) {
        console.error('Error en rollback 004_add_ticket_codigo:', error);
        throw error;
    }
};
