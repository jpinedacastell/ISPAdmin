// @ts-check

const CODIGO_GENERADO = `CONCAT('TCK-', DATE_FORMAT(t.created_at, '%Y%m'), '-', LPAD(t.id, 5, '0'))`;

// La columna codigo_ticket la agrega la migración 004; se revisa una vez por proceso
let cacheSoportaCodigoTicket = null;

class TicketRepository {
    /** @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} conexion */
    constructor(conexion) {
        this.conexion = conexion;
    }

    async soportaCodigoTicket() {
        if (cacheSoportaCodigoTicket !== null) return cacheSoportaCodigoTicket;
        const [rows] = await this.conexion.query(`
        SELECT COUNT(*) AS total
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'tickets'
          AND COLUMN_NAME = 'codigo_ticket'
    `);
        cacheSoportaCodigoTicket = rows[0].total > 0;
        return cacheSoportaCodigoTicket;
    }

    async #expresionCodigo() {
        return (await this.soportaCodigoTicket())
            ? `COALESCE(t.codigo_ticket, ${CODIGO_GENERADO})`
            : CODIGO_GENERADO;
    }

    // ---------- Lectura ----------

    /** Clientes con plan activo vigente (pueden abrir tickets) */
    async clientesConPlanActivo() {
        const [clientes] = await this.conexion.query(`
            SELECT DISTINCT c.id, c.nombre, c.apellido
            FROM clientes c
            INNER JOIN cliente_plan cp ON cp.cliente_id = c.id
            WHERE cp.activo = 1
              AND cp.fecha_fin IS NULL
            ORDER BY c.nombre, c.apellido
        `);
        return clientes;
    }

    async listar() {
        const codigoExpr = await this.#expresionCodigo();
        const [tickets] = await this.conexion.query(`
            SELECT 
                t.id, t.asunto, t.estado, t.prioridad, t.created_at,
                ${codigoExpr} AS ticket_codigo,
                c.nombre as cliente_nombre, c.apellido as cliente_apellido
            FROM tickets t
            JOIN clientes c ON t.cliente_id = c.id
            ORDER BY t.created_at DESC
        `);
        return tickets;
    }

    async obtenerConCliente(id) {
        const codigoExpr = await this.#expresionCodigo();
        const [ticketData] = await this.conexion.query(`
            SELECT 
                t.*,
                ${codigoExpr} AS ticket_codigo,
                c.nombre as cliente_nombre, c.apellido as cliente_apellido
            FROM tickets t
            JOIN clientes c ON t.cliente_id = c.id
            WHERE t.id = ?
        `, [id]);
        return ticketData[0];
    }

    async comentarios(ticketId) {
        const [comentarios] = await this.conexion.query(`
            SELECT tc.*, a.nombre as autor_nombre
            FROM ticket_comentarios tc
            JOIN administradores a ON tc.usuario_id = a.id
            WHERE tc.ticket_id = ?
            ORDER BY tc.created_at DESC
        `, [ticketId]);
        return comentarios;
    }

    async servicios(ticketId) {
        const [servicios] = await this.conexion.query(`
            SELECT ts.id, ts.cantidad, ts.precio_unitario, sc.nombre
            FROM ticket_servicios ts
            JOIN servicios_catalogo sc ON ts.servicio_id = sc.id
            WHERE ts.ticket_id = ?
        `, [ticketId]);
        return servicios;
    }

    async costos(ticketId) {
        const [costos] = await this.conexion.query(`
            SELECT id, descripcion, monto
            FROM ticket_costos
            WHERE ticket_id = ?
            ORDER BY id DESC
        `, [ticketId]);
        return costos;
    }

    /** Suma de servicios (cantidad × precio) y de costos adicionales del ticket */
    async totales(ticketId) {
        const [[totalesServicios]] = await this.conexion.query(
            'SELECT COALESCE(SUM(cantidad * precio_unitario), 0) AS total_servicios FROM ticket_servicios WHERE ticket_id = ?',
            [ticketId]
        );
        const [[totalesCostos]] = await this.conexion.query(
            'SELECT COALESCE(SUM(monto), 0) AS total_costos FROM ticket_costos WHERE ticket_id = ?',
            [ticketId]
        );
        return {
            totalServicios: Number(totalesServicios.total_servicios || 0),
            totalCostos: Number(totalesCostos.total_costos || 0)
        };
    }

    // ---------- Ticket ----------

    /** @returns {Promise<number>} id del ticket */
    async crear({ cliente_id, asunto, descripcion, prioridad, usuarioId }) {
        const [ticketResult] = await this.conexion.query(
            'INSERT INTO tickets (cliente_id, asunto, descripcion, prioridad, usuario_apertura_id) VALUES (?, ?, ?, ?, ?)',
            [cliente_id, asunto, descripcion, prioridad, usuarioId]
        );
        return /** @type {any} */ (ticketResult).insertId;
    }

    async fechaCreacion(id) {
        const [ticketRow] = await this.conexion.query('SELECT created_at FROM tickets WHERE id = ?', [id]);
        return ticketRow[0]?.created_at;
    }

    async asignarCodigo(id, codigo) {
        await this.conexion.query(
            'UPDATE tickets SET codigo_ticket = ? WHERE id = ?',
            [codigo, id]
        );
    }

    async actualizarCostoTotal(id, costoTotal) {
        await this.conexion.query('UPDATE tickets SET costo_total = ? WHERE id = ?', [costoTotal, id]);
    }

    /** Costo total = suma de sus servicios */
    async recalcularCostoTotal(id) {
        await this.conexion.query(`
            UPDATE tickets t
            SET costo_total = (SELECT COALESCE(SUM(cantidad * precio_unitario), 0) FROM ticket_servicios WHERE ticket_id = t.id)
            WHERE t.id = ?
        `, [id]);
    }

    /** @returns {Promise<number>} filas afectadas */
    async actualizarEstado(id, estado, prioridad) {
        const [result] = await this.conexion.query(
            'UPDATE tickets SET estado = ?, prioridad = ? WHERE id = ?',
            [estado, prioridad, id]
        );
        return /** @type {any} */ (result).affectedRows;
    }

    async agregarComentario({ ticketId, usuarioId, comentario, fotoUrl }) {
        await this.conexion.query(
            'INSERT INTO ticket_comentarios (ticket_id, usuario_id, comentario, foto_url) VALUES (?, ?, ?, ?)',
            [ticketId, usuarioId, comentario, fotoUrl]
        );
    }

    // ---------- Costos adicionales ----------

    /** @returns {Promise<number>} id del costo */
    async agregarCosto(ticketId, descripcion, monto) {
        const [insertResult] = await this.conexion.query(
            'INSERT INTO ticket_costos (ticket_id, descripcion, monto) VALUES (?, ?, ?)',
            [ticketId, descripcion, monto]
        );
        return /** @type {any} */ (insertResult).insertId;
    }

    /** @returns {Promise<number | undefined>} */
    async ticketDeCosto(costoId) {
        const [costoRows] = await this.conexion.query('SELECT ticket_id FROM ticket_costos WHERE id = ?', [costoId]);
        return costoRows[0]?.ticket_id;
    }

    async eliminarCosto(costoId) {
        await this.conexion.query('DELETE FROM ticket_costos WHERE id = ?', [costoId]);
    }

    // ---------- Servicios del ticket ----------

    /** @returns {Promise<number>} id del servicio en el ticket */
    async agregarServicio(ticketId, servicioId, cantidad, precioUnitario) {
        const [insert] = await this.conexion.query(
            'INSERT INTO ticket_servicios (ticket_id, servicio_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
            [ticketId, servicioId, cantidad, precioUnitario]
        );
        return /** @type {any} */ (insert).insertId;
    }

    /** @returns {Promise<{ ticket_id: number, cantidad: number } | undefined>} */
    async servicioDeTicket(ticketServicioId) {
        const [itemData] = await this.conexion.query(
            'SELECT ticket_id, cantidad FROM ticket_servicios WHERE id = ?',
            [ticketServicioId]
        );
        return itemData[0];
    }

    async eliminarServicio(ticketServicioId) {
        await this.conexion.query('DELETE FROM ticket_servicios WHERE id = ?', [ticketServicioId]);
    }

    async actualizarPrecioServicio(ticketServicioId, precioUnitario) {
        await this.conexion.query(
            'UPDATE ticket_servicios SET precio_unitario = ? WHERE id = ?',
            [precioUnitario, ticketServicioId]
        );
    }
}

module.exports = { TicketRepository };
