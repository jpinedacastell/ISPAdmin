// @ts-check

class ContabilidadRepository {
    /** @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} conexion */
    constructor(conexion) {
        this.conexion = conexion;
    }

    /** Movimientos manuales y costos de tickets del mes, del más reciente al más antiguo */
    async movimientosDelMes(mes, anio) {
        const [movimientos] = await this.conexion.query(`
                SELECT *
                FROM (
                    -- Movimientos financieros manuales
                    SELECT
                        m.fecha,
                        m.tipo,
                        m.descripcion,
                        CONCAT_WS(' ', c.nombre, c.apellido) AS cliente_nombre,
                        m.monto
                    FROM movimientos_financieros m
                    LEFT JOIN clientes c ON m.cliente_id = c.id
                    WHERE MONTH(m.fecha) = ? AND YEAR(m.fecha) = ?
    
                    UNION ALL
    
                    -- Ticket en una sola línea (servicios + costos)
                    SELECT
                        t.created_at AS fecha,
                        'egreso' AS tipo,
                        CONCAT('Ticket #', t.id, ' - Costo operativo total') AS descripcion,
                        CONCAT_WS(' ', c.nombre, c.apellido) AS cliente_nombre,
                        (
                            COALESCE(ts_tot.total_servicios, 0) +
                            COALESCE(tc_tot.total_costos, 0)
                        ) AS monto
                    FROM tickets t
                    LEFT JOIN clientes c ON c.id = t.cliente_id
                    LEFT JOIN (
                        SELECT ticket_id, COALESCE(SUM(cantidad * precio_unitario), 0) AS total_servicios
                        FROM ticket_servicios
                        GROUP BY ticket_id
                    ) ts_tot ON ts_tot.ticket_id = t.id
                    LEFT JOIN (
                        SELECT ticket_id, COALESCE(SUM(monto), 0) AS total_costos
                        FROM ticket_costos
                        GROUP BY ticket_id
                    ) tc_tot ON tc_tot.ticket_id = t.id
                    WHERE MONTH(t.created_at) = ?
                      AND YEAR(t.created_at) = ?
                      AND (
                            COALESCE(ts_tot.total_servicios, 0) +
                            COALESCE(tc_tot.total_costos, 0)
                          ) > 0
                ) movimientos_unificados
                ORDER BY fecha DESC
            `, [mes, anio, mes, anio]);
        return movimientos;
    }

    /** Totales de ingresos y egresos del mes */
    async resumenDelMes(mes, anio) {
        const [summary] = await this.conexion.query(`
                SELECT
                    COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) AS totalIngresos,
                    COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END), 0) AS totalEgresos
                FROM (
                    SELECT m.tipo, m.monto
                    FROM movimientos_financieros m
                    WHERE MONTH(m.fecha) = ? AND YEAR(m.fecha) = ?
    
                    UNION ALL
    
                    SELECT
                        'egreso' AS tipo,
                        (
                            COALESCE(ts_tot.total_servicios, 0) +
                            COALESCE(tc_tot.total_costos, 0)
                        ) AS monto
                    FROM tickets t
                    LEFT JOIN (
                        SELECT ticket_id, COALESCE(SUM(cantidad * precio_unitario), 0) AS total_servicios
                        FROM ticket_servicios
                        GROUP BY ticket_id
                    ) ts_tot ON ts_tot.ticket_id = t.id
                    LEFT JOIN (
                        SELECT ticket_id, COALESCE(SUM(monto), 0) AS total_costos
                        FROM ticket_costos
                        GROUP BY ticket_id
                    ) tc_tot ON tc_tot.ticket_id = t.id
                    WHERE MONTH(t.created_at) = ?
                      AND YEAR(t.created_at) = ?
                      AND (
                            COALESCE(ts_tot.total_servicios, 0) +
                            COALESCE(tc_tot.total_costos, 0)
                          ) > 0
                ) resumen_unificado
            `, [mes, anio, mes, anio]);
        return summary[0];
    }
}

module.exports = { ContabilidadRepository };
