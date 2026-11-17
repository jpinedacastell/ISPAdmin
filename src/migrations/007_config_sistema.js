const pool = require('../config/database');

exports.up = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS config_sistema (
                id INT NOT NULL PRIMARY KEY,
                nombre_sistema VARCHAR(60) NOT NULL DEFAULT 'ISP Admin',
                logo_url VARCHAR(255) NOT NULL DEFAULT '/img/Logo.png',
                empresa_nombre VARCHAR(100) NULL,
                empresa_rtn VARCHAR(20) NULL,
                empresa_telefono VARCHAR(30) NULL,
                empresa_direccion VARCHAR(200) NULL,
                empresa_email VARCHAR(100) NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Fila única con los datos que estaban fijos en las vistas
        await pool.query(`
            INSERT IGNORE INTO config_sistema
                (id, nombre_sistema, logo_url, empresa_nombre, empresa_rtn, empresa_telefono, empresa_direccion, empresa_email)
            VALUES
                (1, 'ISP Admin', '/img/Logo.png', 'CONETXA', '', '(504) 8780-3554', 'Cofradia, Cortes, Honduras', 'info@conetxahn.com')
        `);

        console.log('Migración 007_config_sistema completada');
    } catch (error) {
        console.error('Error en migración 007_config_sistema:', error);
        throw error;
    }
};

exports.down = async () => {
    try {
        await pool.query('DROP TABLE IF EXISTS config_sistema');
        console.log('Rollback de 007_config_sistema completado');
    } catch (error) {
        console.error('Error en rollback 007_config_sistema:', error);
        throw error;
    }
};
