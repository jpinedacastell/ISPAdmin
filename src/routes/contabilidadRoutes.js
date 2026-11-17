const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../config/database');

// GET /contabilidad - Muestra la vista principal (sin cambios)
router.get('/', verifyToken, (req, res) => {
    res.render('contabilidad/index', {
        title: 'Contabilidad',
        currentPage: 'contabilidad',
        user: req.session.user
    });
});

// API para la tabla, AHORA CON FILTROS
router.get('/list', verifyToken, async (req, res) => {
    try {
        const mes = Number(req.query.mes) || (new Date().getMonth() + 1);
        const anio = Number(req.query.anio) || new Date().getFullYear();

        const [movimientos] = await db.query(`
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

        res.json(movimientos);
    } catch (error) {
        console.error('Error al obtener movimientos contables:', error);
        res.status(500).json({ error: 'Error al obtener movimientos contables.' });
    }
});

// NUEVA API para el resumen del mes
router.get('/summary', verifyToken, async (req, res) => {
    try {
        const mes = Number(req.query.mes) || (new Date().getMonth() + 1);
        const anio = Number(req.query.anio) || new Date().getFullYear();

        const [summary] = await db.query(`
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

        res.json(summary[0]);
    } catch (error) {
        console.error('Error al obtener resumen contable:', error);
        res.status(500).json({ error: 'Error al obtener resumen contable.' });
    }
});

module.exports = router;
