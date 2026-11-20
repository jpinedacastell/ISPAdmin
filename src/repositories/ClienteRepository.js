// @ts-check

const { DEPENDENCIAS_CLIENTE } = require('../domain/clientes/dependenciasCliente');
const { CAMPOS_UNICOS } = require('../domain/clientes/datosCliente');

const TABLA_NO_EXISTE = 'ER_NO_SUCH_TABLE';

const TABLAS_PERMITIDAS = new Set(DEPENDENCIAS_CLIENTE.map(({ tabla }) => tabla));
const CAMPOS_BUSCABLES = new Set(CAMPOS_UNICOS.map(({ campo }) => campo));

/** @typedef {import('../domain/clientes/datosCliente').DatosCliente} DatosCliente */

class ClienteRepository {
    /** @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} conexion */
    constructor(conexion) {
        this.conexion = conexion;
    }

    /** @param {number} clienteId @returns {Promise<boolean>} */
    async existe(clienteId) {
        const [filas] = await this.conexion.query(
            'SELECT 1 FROM clientes WHERE id = ? LIMIT 1',
            [clienteId]
        );
        return /** @type {any[]} */ (filas).length > 0;
    }

    /**
     * @param {string} tabla
     * @param {number} clienteId
     * @returns {Promise<number>}
     */
    async contarRelacionados(tabla, clienteId) {
        // El nombre de la tabla va directo al SQL, solo se aceptan las conocidas
        if (!TABLAS_PERMITIDAS.has(tabla)) {
            throw new Error(`Tabla no permitida: ${tabla}`);
        }
        const [filas] = await this.conexion.query(
            'SELECT COUNT(*) AS total FROM ?? WHERE cliente_id = ?',
            [tabla, clienteId]
        );
        return Number(/** @type {any[]} */ (filas)[0].total);
    }

    /**
     * @param {'dni' | 'email'} campo
     * @param {string} valor
     * @param {number | null} [excluirId] para no chocar con el mismo cliente al editar
     * @returns {Promise<boolean>}
     */
    async existeConCampo(campo, valor, excluirId = null) {
        if (!CAMPOS_BUSCABLES.has(campo)) {
            throw new Error(`Campo no permitido: ${campo}`);
        }
        const [filas] = await this.conexion.query(
            'SELECT 1 FROM clientes WHERE ?? = ? AND id <> ? LIMIT 1',
            [campo, valor, excluirId ?? 0]
        );
        return /** @type {any[]} */ (filas).length > 0;
    }

    /**
     * @param {import('../domain/clientes/datosCliente').DatosCliente} datos
     * @param {number | null} [excluirId]
     * @returns {Promise<string | null>} mensaje del primer duplicado, o null
     */
    async buscarDuplicado(datos, excluirId = null) {
        for (const { campo, mensaje } of CAMPOS_UNICOS) {
            const valor = datos[campo];
            if (valor && await this.existeConCampo(campo, valor, excluirId)) return mensaje;
        }
        return null;
    }

    /** @param {number} clienteId @returns {Promise<void>} */
    async eliminar(clienteId) {
        await this.conexion.query('DELETE FROM clientes WHERE id = ?', [clienteId]);
    }

    // ---------- Consultas ----------

    /** Todos los clientes con su plan vigente (sin fecha_fin) */
    async listarConPlan() {
        const [clientes] = await this.conexion.query(`
            SELECT 
                c.*,
                cp.plan_id,
                cp.activo,
                p.nombre as plan_nombre,
                p.velocidad_descarga,
                p.velocidad_subida,
                p.precio
            FROM clientes c
            LEFT JOIN (
                SELECT cliente_id, plan_id, activo
                FROM cliente_plan
                WHERE fecha_fin IS NULL
            ) cp ON c.id = cp.cliente_id
            LEFT JOIN planes p ON cp.plan_id = p.id
            ORDER BY c.nombre, c.apellido
        `);
        return clientes;
    }

    /** Cliente con su plan vigente (sin fecha_fin), o undefined */
    async obtenerConPlanVigente(id) {
        const [clientes] = await this.conexion.query(`
            SELECT 
                c.*,
                cp.plan_id,
                cp.activo,
                cp.fecha_inicio,
                p.nombre as plan_nombre,
                p.velocidad_descarga,
                p.velocidad_subida,
                p.precio
            FROM clientes c
            LEFT JOIN cliente_plan cp ON c.id = cp.cliente_id AND cp.fecha_fin IS NULL
            LEFT JOIN planes p ON cp.plan_id = p.id
            WHERE c.id = ?
        `, [id]);
        return clientes[0];
    }

    /** Cliente con su plan marcado como activo, o undefined */
    async obtenerConPlanActivo(id) {
        const [clientes] = await this.conexion.query(`
            SELECT 
                c.*,
                cp.plan_id,
                cp.activo,
                cp.fecha_inicio,
                p.nombre as plan_nombre,
                p.velocidad_descarga,
                p.velocidad_subida,
                p.precio
            FROM clientes c
            LEFT JOIN cliente_plan cp ON c.id = cp.cliente_id AND cp.activo = 1
            LEFT JOIN planes p ON cp.plan_id = p.id
            WHERE c.id = ?
        `, [id]);
        return clientes[0];
    }

    async facturasDeCliente(id) {
        const [facturas] = await this.conexion.query(`
            SELECT 
                id, numero_factura, cliente_id, plan_id,
                DATE_FORMAT(fecha_emision, '%Y-%m-%d') as fecha_emision,
                DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') as fecha_vencimiento,
                DATE_FORMAT(mes_facturado, '%Y-%m-01') as mes_facturado,
                CAST(monto as DECIMAL(10,2)) as monto,
                COALESCE(monto_pagado, 0) as monto_pagado,
                COALESCE(pago_recibido, 0) as pago_recibido,
                COALESCE(credito_aplicado, 0) as credito_aplicado,
                COALESCE(abono_siguiente, 0) as abono_siguiente,
                GREATEST(
                    (monto - COALESCE(descuento_monto, 0)) -
                    COALESCE(monto_pagado, 0) -
                    COALESCE(credito_aplicado, 0),
                    0
                ) as saldo_pendiente,
                estado, metodo_pago,
                YEAR(mes_facturado) as año_facturado,
                MONTH(mes_facturado) as mes_facturado_index
            FROM facturas 
            WHERE cliente_id = ? 
            ORDER BY mes_facturado DESC
        `, [id]);
        return facturas;
    }

    async estadoDePago(id) {
        const [estadoPago] = await this.conexion.query(`
            SELECT 
                CASE
                    WHEN COUNT(*) = 0 THEN 'sin_facturas'
                    WHEN SUM(CASE WHEN estado = 'vencida' THEN 1 ELSE 0 END) > 0 THEN 'moroso'
                    WHEN SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) > 0 THEN 'pendiente'
                    ELSE 'al_dia'
                END as estado_pago,
                COUNT(*) as total_facturas,
                SUM(CASE WHEN estado = 'pagada' THEN 1 ELSE 0 END) as facturas_pagadas,
                SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) as facturas_pendientes,
                SUM(CASE WHEN estado = 'vencida' THEN 1 ELSE 0 END) as facturas_vencidas
            FROM facturas 
            WHERE cliente_id = ?
        `, [id]);
        return estadoPago[0];
    }

    async ticketsDeCliente(id) {
        return this.#consultarSiExisteTabla(`
            SELECT * FROM tickets 
            WHERE cliente_id = ? 
            ORDER BY created_at DESC
        `, [id]);
    }

    async notasDeCliente(id) {
        return this.#consultarSiExisteTabla(`
            SELECT * FROM notas_cliente 
            WHERE cliente_id = ? 
            ORDER BY created_at DESC
        `, [id]);
    }

    // Tablas opcionales: si no existen se devuelve una lista vacía
    async #consultarSiExisteTabla(sql, parametros) {
        try {
            const [filas] = await this.conexion.query(sql, parametros);
            return filas;
        } catch (error) {
            if (/** @type {any} */ (error).code !== TABLA_NO_EXISTE) throw error;
            return [];
        }
    }

    // ---------- Escritura ----------

    /** @param {DatosCliente} datos @returns {Promise<number>} id del cliente creado */
    async insertar(datos) {
        const [result] = await this.conexion.query(
            'INSERT INTO clientes (nombre, apellido, dni, email, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?)',
            [datos.nombre, datos.apellido, datos.dni, datos.email, datos.telefono, datos.direccion]
        );
        return /** @type {any} */ (result).insertId;
    }

    /** @param {number | string} id @param {DatosCliente} datos */
    async actualizar(id, datos) {
        await this.conexion.query(
            `UPDATE clientes 
             SET nombre = ?, 
                 apellido = ?, 
                 dni = ?,
                 email = ?, 
                 telefono = ?, 
                 direccion = ?
             WHERE id = ?`,
            [datos.nombre, datos.apellido, datos.dni, datos.email, datos.telefono, datos.direccion, id]
        );
    }

    // ---------- Plan del cliente ----------

    /** Plan asignado al crear el cliente (fecha y hora actuales) */
    async asignarPlanInicial(clienteId, planId) {
        await this.conexion.query(
            'INSERT INTO cliente_plan (cliente_id, plan_id, fecha_inicio, activo) VALUES (?, ?, NOW(), true)',
            [clienteId, planId]
        );
    }

    /** Plan asignado al cambiar de plan (desde hoy) */
    async asignarPlanDesdeHoy(clienteId, planId) {
        await this.conexion.query(
            `INSERT INTO cliente_plan (cliente_id, plan_id, fecha_inicio, activo)
             VALUES (?, ?, CURRENT_DATE(), true)`,
            [clienteId, planId]
        );
    }

    /** @returns {Promise<{ plan_id: number } | undefined>} */
    async planVigente(clienteId) {
        const [planes] = await this.conexion.query(
            'SELECT plan_id FROM cliente_plan WHERE cliente_id = ? AND fecha_fin IS NULL',
            [clienteId]
        );
        return planes[0];
    }

    /** @returns {Promise<{ id: number, activo: number, plan_id: number } | undefined>} */
    async planVigenteConEstado(clienteId) {
        const [planes] = await this.conexion.query(
            'SELECT cp.id, cp.activo, cp.plan_id FROM cliente_plan cp WHERE cp.cliente_id = ? AND cp.fecha_fin IS NULL',
            [clienteId]
        );
        return planes[0];
    }

    async cerrarPlanVigente(clienteId) {
        await this.conexion.query(
            `UPDATE cliente_plan 
             SET fecha_fin = CURRENT_DATE(), activo = false
             WHERE cliente_id = ? AND fecha_fin IS NULL`,
            [clienteId]
        );
    }

    /** @returns {Promise<number>} filas afectadas */
    async cambiarEstadoPlan(clientePlanId, clienteId, activo) {
        const [result] = await this.conexion.query(
            'UPDATE cliente_plan SET activo = ? WHERE id = ? AND cliente_id = ? AND fecha_fin IS NULL',
            [activo, clientePlanId, clienteId]
        );
        return /** @type {any} */ (result).affectedRows;
    }

    // ---------- Notas ----------

    /** @returns {Promise<number>} id de la nota */
    async agregarNota(clienteId, nota) {
        const [result] = await this.conexion.query(
            'INSERT INTO notas_cliente (cliente_id, nota, fecha_creacion) VALUES (?, ?, CURRENT_TIMESTAMP)',
            [clienteId, nota]
        );
        return /** @type {any} */ (result).insertId;
    }

    async eliminarNota(notaId, clienteId) {
        await this.conexion.query(
            'DELETE FROM notas_cliente WHERE id = ? AND cliente_id = ?',
            [notaId, clienteId]
        );
    }
}

module.exports = { ClienteRepository };
