// @ts-check

// Columnas de abonos que versiones anteriores de la BD pueden no tener
const COLUMNAS_ABONOS = Object.freeze({
    monto_pagado: "ADD COLUMN monto_pagado DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Monto en efectivo aplicado a la factura'",
    pago_recibido: "ADD COLUMN pago_recibido DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Total efectivo recibido al cobrar la factura'",
    credito_aplicado: "ADD COLUMN credito_aplicado DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Saldo a favor aplicado a la factura'",
    abono_siguiente: "ADD COLUMN abono_siguiente DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Saldo a favor generado para próximas facturas'"
});

// Filtro del resumen anual según el estado del cliente
const FILTRO_ESTADO_CLIENTE = Object.freeze({
    activos: 'AND cp.activo = 1',
    desactivados: 'AND cp.activo = 0'
});

// Campos de facturas que guardan listas en JSON
const CAMPOS_JSON = ['descuentos', 'prorroga'];

class FacturaRepository {
    /** @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} conexion */
    constructor(conexion) {
        this.conexion = conexion;
    }

    // ---------- Esquema ----------

    async asegurarColumnasDeAbonos() {
        const [columns] = await this.conexion.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'facturas'
              AND COLUMN_NAME IN (?)
        `, [Object.keys(COLUMNAS_ABONOS)]);

        const existingColumns = new Set(/** @type {any[]} */ (columns).map(column => column.COLUMN_NAME));

        for (const [columnName, alterSql] of Object.entries(COLUMNAS_ABONOS)) {
            if (!existingColumns.has(columnName)) {
                await this.conexion.query(`ALTER TABLE facturas ${alterSql}`);
            }
        }
    }

    // ---------- Lectura ----------

    /** @returns {Promise<any | undefined>} */
    async obtener(id) {
        const [factura] = await this.conexion.query('SELECT * FROM facturas WHERE id = ?', [id]);
        return factura[0];
    }

    /** Bloquea la fila hasta terminar la transacción */
    async obtenerParaActualizar(id) {
        const [facturas] = await this.conexion.query('SELECT * FROM facturas WHERE id = ? FOR UPDATE', [id]);
        return facturas[0];
    }

    async listar() {
        const [facturas] = await this.conexion.query(`
                SELECT
                    f.*,
                    GREATEST(
                        (f.monto - COALESCE(f.descuento_monto, 0)) -
                        COALESCE(f.monto_pagado, 0) -
                        COALESCE(f.credito_aplicado, 0),
                        0
                    ) AS saldo_pendiente,
                    c.nombre as cliente_nombre,
                    c.apellido as cliente_apellido,
                    c.dni as cliente_dni,
                    c.email as cliente_email,
                    c.telefono as cliente_telefono,
                    c.direccion as cliente_direccion,
                    p.nombre as plan_nombre,
                    p.velocidad_descarga,
                    p.velocidad_subida
                FROM facturas f
                INNER JOIN clientes c ON f.cliente_id = c.id
                INNER JOIN planes p ON f.plan_id = p.id
                ORDER BY f.fecha_emision DESC
            `);
        return facturas;
    }

    async listarDeCliente(clienteId) {
        const [facturas] = await this.conexion.query(`
                SELECT
                    f.*,
                    GREATEST(
                        (f.monto - COALESCE(f.descuento_monto, 0)) -
                        COALESCE(f.monto_pagado, 0) -
                        COALESCE(f.credito_aplicado, 0),
                        0
                    ) AS saldo_pendiente,
                    c.nombre as cliente_nombre,
                    c.apellido as cliente_apellido,
                    p.nombre as plan_nombre,
                    p.velocidad_descarga,
                    p.velocidad_subida
                FROM facturas f
                INNER JOIN clientes c ON f.cliente_id = c.id
                INNER JOIN planes p ON f.plan_id = p.id
                WHERE f.cliente_id = ?
                ORDER BY f.fecha_emision DESC
            `, [clienteId]);
        return facturas;
    }

    /** Factura con datos del cliente y del plan para la vista de detalle */
    async obtenerDetalle(id) {
        const [facturas] = await this.conexion.query(`
                SELECT
                    f.*,
                    GREATEST(
                        (f.monto - COALESCE(f.descuento_monto, 0)) -
                        COALESCE(f.monto_pagado, 0) -
                        COALESCE(f.credito_aplicado, 0),
                        0
                    ) AS saldo_pendiente,
                    DATE_FORMAT(f.mes_facturado, '%Y-%m-01') as mes_facturado,
                    c.nombre as cliente_nombre,
                    c.apellido as cliente_apellido,
                    c.dni as cliente_dni,
                    c.email as cliente_email,
                    c.telefono as cliente_telefono,
                    c.direccion as cliente_direccion,
                    p.nombre as plan_nombre,
                    p.velocidad_descarga,
                    p.velocidad_subida
                FROM facturas f
                INNER JOIN clientes c ON f.cliente_id = c.id
                INNER JOIN planes p ON f.plan_id = p.id
                WHERE f.id = ?
            `, [id]);
        return facturas[0];
    }

    /** Factura con cliente y plan, con los campos JSON ya convertidos (para la prórroga) */
    async obtenerConClienteYPlan(id) {
        const [results] = await this.conexion.query(`
                SELECT
                    f.*,
                    c.nombre as cliente_nombre,
                    c.apellido as cliente_apellido,
                    c.dni as cliente_dni,
                    c.email as cliente_email,
                    c.telefono as cliente_telefono,
                    c.direccion as cliente_direccion,
                    p.nombre as plan_nombre,
                    p.velocidad_descarga,
                    p.velocidad_subida,
                    p.descripcion as plan_descripcion
                FROM facturas f
                INNER JOIN clientes c ON f.cliente_id = c.id
                INNER JOIN planes p ON f.plan_id = p.id
                WHERE f.id = ?`, [id]);

        const factura = results[0];
        if (factura) {
            CAMPOS_JSON
                .filter((campo) => typeof factura[campo] === 'string')
                .forEach((campo) => { factura[campo] = JSON.parse(factura[campo]); });
        }
        return factura;
    }

    /** @returns {Promise<number>} */
    async saldoFavorDeCliente(clienteId) {
        const [rows] = await this.conexion.query(`
            SELECT
                GREATEST(
                    COALESCE(SUM(abono_siguiente), 0) - COALESCE(SUM(credito_aplicado), 0),
                    0
                ) AS saldo_favor
            FROM facturas
            WHERE cliente_id = ?
        `, [clienteId]);
        return rows[0]?.saldo_favor;
    }

    /** Pendientes o vencidas del cliente, de la más antigua a la más nueva, bloqueadas para actualizar */
    async pendientesParaAbonar(clienteId, excluirFacturaId = null) {
        const params = [clienteId];
        let excluirFacturaSql = '';

        if (excluirFacturaId) {
            excluirFacturaSql = 'AND id <> ?';
            params.push(excluirFacturaId);
        }

        const [facturasPendientes] = await this.conexion.query(`
            SELECT *
            FROM facturas
            WHERE cliente_id = ?
              ${excluirFacturaSql}
              AND estado IN ('pendiente', 'vencida')
            ORDER BY mes_facturado ASC, fecha_emision ASC, id ASC
            FOR UPDATE
        `, params);
        return facturasPendientes;
    }

    // ---------- Escritura ----------

    async aplicarCredito(id, { creditoAplicado, estado, quedaPagada }) {
        await this.conexion.query(`
                UPDATE facturas
                SET credito_aplicado = ?,
                    estado = ?,
                    fecha_pago = CASE WHEN ? THEN COALESCE(fecha_pago, CURDATE()) ELSE fecha_pago END,
                    metodo_pago = CASE WHEN ? THEN COALESCE(metodo_pago, 'Abono a favor') ELSE metodo_pago END
                WHERE id = ?
            `, [creditoAplicado, estado, quedaPagada, quedaPagada, id]);
    }

    /** @returns {Promise<number>} filas afectadas */
    async aplicarDescuento(id, { porcentaje, monto, motivo }) {
        const [result] = await this.conexion.query(`
                UPDATE facturas
                SET descuento_porcentaje = ?,
                    descuento_monto = ?,
                    motivo_descuento = ?
                WHERE id = ?
            `, [porcentaje, monto, motivo, id]);
        return /** @type {any} */ (result).affectedRows;
    }

    async marcarPagada(id, { estado, fechaPago, metodoPago, montoPagado }) {
        await this.conexion.query(`
                    UPDATE facturas
                    SET estado = ?,
                        fecha_pago = ?,
                        metodo_pago = ?,
                        monto_pagado = ?,
                        pago_recibido = GREATEST(pago_recibido, ?)
                    WHERE id = ?
                `, [estado, fechaPago, metodoPago, montoPagado, montoPagado, id]);
    }

    async cambiarEstado(id, { estado, fechaPago, metodoPago }) {
        await this.conexion.query(`
                    UPDATE facturas
                    SET estado = ?,
                        fecha_pago = ?,
                        metodo_pago = ?
                    WHERE id = ?
                `, [estado, fechaPago, metodoPago, id]);
    }

    async registrarPago(id, { montoPagado, pagoRecibido, abonoSiguiente, estado, quedaPagada, metodoPago }) {
        await this.conexion.query(`
                UPDATE facturas
                SET monto_pagado = ?,
                    pago_recibido = ?,
                    abono_siguiente = ?,
                    estado = ?,
                    fecha_pago = CASE WHEN ? THEN CURDATE() ELSE fecha_pago END,
                    metodo_pago = ?
                WHERE id = ?
            `, [montoPagado, pagoRecibido, abonoSiguiente, estado, quedaPagada, metodoPago, id]);
    }

    /**
     * Actualiza los campos indicados; las listas (descuentos, prorroga) se guardan como JSON.
     * Los nombres de campo vienen del servicio, nunca del usuario.
     * @param {Record<string, unknown>} cambios
     */
    async actualizarCampos(id, cambios) {
        const valores = Object.fromEntries(Object.entries(cambios).map(([campo, valor]) => [
            campo,
            CAMPOS_JSON.includes(campo) && valor ? JSON.stringify(valor) : valor
        ]));
        const setClause = Object.keys(valores).map((campo) => `${campo} = ?`).join(', ');

        const [result] = await this.conexion.query(
            `UPDATE facturas SET ${setClause} WHERE id = ?`,
            [...Object.values(valores), id]
        );
        return result;
    }

    // ---------- Generación mensual ----------

    async configuracionDeNumeracion() {
        const [config] = await this.conexion.query('SELECT * FROM config_facturacion LIMIT 1');
        return config[0];
    }

    /** Incrementa el correlativo y devuelve el nuevo número */
    async siguienteNumero(configId) {
        await this.conexion.query(
            'UPDATE config_facturacion SET ultimo_numero = ultimo_numero + 1 WHERE id = ?',
            [configId]
        );

        const [result] = await this.conexion.query(
            'SELECT ultimo_numero FROM config_facturacion WHERE id = ?',
            [configId]
        );
        return result[0].ultimo_numero;
    }

    /** @param {string} mes formato YYYY-MM */
    async contarDelMes(mes) {
        const [facturasExistentes] = await this.conexion.query(
            'SELECT COUNT(*) as total FROM facturas WHERE DATE_FORMAT(mes_facturado, "%Y-%m") = ?',
            [mes]
        );
        return facturasExistentes[0].total;
    }

    /** Clientes con plan activo que aún no tienen factura en el mes (YYYY-MM) */
    async clientesPorFacturar(mes) {
        const [clientes] = await this.conexion.query(`
                SELECT
                    c.id as cliente_id,
                    c.nombre,
                    c.apellido,
                    c.email,
                    cp.plan_id,
                    p.nombre as plan_nombre,
                    p.precio
                FROM clientes c
                INNER JOIN cliente_plan cp ON c.id = cp.cliente_id
                INNER JOIN planes p ON cp.plan_id = p.id
                WHERE cp.activo = true
                AND cp.fecha_fin IS NULL
                AND NOT EXISTS (
                    SELECT 1
                    FROM facturas f
                    WHERE f.cliente_id = c.id
                    AND DATE_FORMAT(f.mes_facturado, "%Y-%m") = ?
                )
            `, [mes]);
        return clientes;
    }

    async insertar(f) {
        await this.conexion.query(`
                        INSERT INTO facturas (
                            cliente_id,
                            plan_id,
                            numero_factura,
                            fecha_emision,
                            fecha_vencimiento,
                            mes_facturado,
                            monto,
                            estado,
                            credito_aplicado,
                            fecha_pago,
                            metodo_pago
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
            f.cliente_id,
            f.plan_id,
            f.numero_factura,
            f.fecha_emision,
            f.fecha_vencimiento,
            f.mes_facturado,
            f.monto,
            f.estado,
            f.credito_aplicado,
            f.fecha_pago,
            f.metodo_pago
        ]);
    }

    // ---------- Resumen anual ----------

    /** Por cliente y mes: si tiene factura pagada y cuántas facturas tiene */
    async resumenAnualPorMes(anio, estadoCliente) {
        const filtroEstadoSql = FILTRO_ESTADO_CLIENTE[estadoCliente] || '';
        const [rows] = await this.conexion.query(`
            SELECT
                c.id AS cliente_id,
                c.nombre AS cliente_nombre,
                c.apellido AS cliente_apellido,
                c.created_at AS cliente_creado_en,
                cp.activo AS cliente_activo,
                MONTH(f.mes_facturado) AS mes_numero,
                MAX(CASE WHEN f.estado = 'pagada' THEN 1 ELSE 0 END) AS pagada,
                COUNT(f.id) AS total_facturas_mes
            FROM clientes c
            LEFT JOIN cliente_plan cp
                ON cp.cliente_id = c.id
                AND cp.fecha_fin IS NULL
            LEFT JOIN facturas f
                ON f.cliente_id = c.id
                AND YEAR(f.mes_facturado) = ?
            WHERE 1=1
                ${filtroEstadoSql}
            GROUP BY c.id, c.nombre, c.apellido, MONTH(f.mes_facturado)
            ORDER BY c.nombre ASC, c.apellido ASC
        `, [anio]);
        return rows;
    }

    /** Total por pagar de cada cliente en el año */
    async deudasDelAnio(anio, estadoCliente) {
        const filtroEstadoSql = FILTRO_ESTADO_CLIENTE[estadoCliente] || '';
        const [deudas] = await this.conexion.query(`
            SELECT
                c.id AS cliente_id,
                COALESCE(SUM(
                    CASE
                        WHEN f.estado IN ('pendiente', 'vencida')
                        THEN GREATEST(
                            (f.monto - COALESCE(f.descuento_monto, 0)) -
                            COALESCE(f.monto_pagado, 0) -
                            COALESCE(f.credito_aplicado, 0),
                            0
                        )
                        ELSE 0
                    END
                ), 0) AS total_por_pagar
            FROM clientes c
            LEFT JOIN cliente_plan cp
                ON cp.cliente_id = c.id
                AND cp.fecha_fin IS NULL
            LEFT JOIN facturas f
                ON f.cliente_id = c.id
                AND YEAR(f.mes_facturado) = ?
            WHERE 1=1
                ${filtroEstadoSql}
            GROUP BY c.id
        `, [anio]);
        return deudas;
    }
}

module.exports = { FacturaRepository };
