const pool = require('../config/database');

const columns = {
    monto_pagado: "ADD COLUMN monto_pagado DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Monto en efectivo aplicado a la factura'",
    pago_recibido: "ADD COLUMN pago_recibido DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Total efectivo recibido al cobrar la factura'",
    credito_aplicado: "ADD COLUMN credito_aplicado DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Saldo a favor aplicado a la factura'",
    abono_siguiente: "ADD COLUMN abono_siguiente DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Saldo a favor generado para próximas facturas'"
};

exports.up = async () => {
    const [existingColumns] = await pool.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'facturas'
          AND COLUMN_NAME IN (?)
    `, [Object.keys(columns)]);

    const existing = new Set(existingColumns.map(column => column.COLUMN_NAME));

    for (const [name, alterSql] of Object.entries(columns)) {
        if (!existing.has(name)) {
            await pool.query(`ALTER TABLE facturas ${alterSql}`);
            console.log(`Columna ${name} agregada exitosamente`);
        }
    }
};

exports.down = async () => {
    for (const name of Object.keys(columns).reverse()) {
        try {
            await pool.query(`ALTER TABLE facturas DROP COLUMN ${name}`);
            console.log(`Columna ${name} eliminada exitosamente`);
        } catch (error) {
            if (error.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
                throw error;
            }
        }
    }
};
