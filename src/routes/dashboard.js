const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../config/database');

// Ruta principal del dashboard
router.get('/', verifyToken, async (req, res) => {
    try {
        res.render('dashboard', {
            title: 'Dashboard',
            user: req.user
        });
    } catch (error) {
        console.error('Error al cargar el dashboard:', error);
        res.status(500).send('Error al cargar el dashboard');
    }
});

// API para obtener estadísticas del dashboard
router.get('/stats', verifyToken, async (req, res) => {
    try {
        // Obtener total de clientes
        const [clientesResult] = await db.query('SELECT COUNT(*) as total FROM clientes');
        const totalClientes = clientesResult[0].total;

        // Obtener ingresos mensuales (del mes actual)
        const [ingresosResult] = await db.query(`
            SELECT COALESCE(SUM(monto), 0) as total 
            FROM facturas 
            WHERE MONTH(fecha_emision) = MONTH(CURRENT_DATE()) 
            AND YEAR(fecha_emision) = YEAR(CURRENT_DATE())
            AND estado = 'pagado'
        `);
        const ingresosMensuales = ingresosResult[0].total;

        // Obtener ancho de banda total asignado
        const [anchoBandaResult] = await db.query(`
            SELECT COALESCE(SUM(p.velocidad_mbps), 0) as total
            FROM contratos c
            JOIN planes p ON c.plan_id = p.id
            WHERE c.estado = 'activo'
        `);
        const anchoBandaTotal = anchoBandaResult[0].total;

        // Obtener tickets pendientes
        const [ticketsResult] = await db.query(`
            SELECT COUNT(*) as total 
            FROM tickets 
            WHERE estado = 'pendiente'
        `);
        const ticketsPendientes = ticketsResult[0].total;

        // Obtener ingresos anuales (últimos 12 meses)
        const [ingresosAnualesResult] = await db.query(`
            SELECT MONTH(fecha_emision) as mes, 
                   COALESCE(SUM(monto), 0) as total
            FROM facturas
            WHERE fecha_emision >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
            AND estado = 'pagado'
            GROUP BY MONTH(fecha_emision)
            ORDER BY mes
        `);
        
        // Crear array de 12 meses con valores en 0
        const ingresosAnuales = new Array(12).fill(0);
        ingresosAnualesResult.forEach(row => {
            ingresosAnuales[row.mes - 1] = row.total;
        });

        // Obtener distribución de planes
        const [distribucionPlanesResult] = await db.query(`
            SELECT p.nombre, COUNT(*) as total
            FROM contratos c
            JOIN planes p ON c.plan_id = p.id
            WHERE c.estado = 'activo'
            GROUP BY p.nombre
        `);
        
        const distribucionPlanes = {
            'Básico': 0,
            'Estándar': 0,
            'Premium': 0,
            'Empresarial': 0
        };
        
        distribucionPlanesResult.forEach(row => {
            if (distribucionPlanes.hasOwnProperty(row.nombre)) {
                distribucionPlanes[row.nombre] = row.total;
            }
        });

        // Obtener últimas instalaciones
        const [ultimasInstalacionesResult] = await db.query(`
            SELECT 
                c.nombre as cliente,
                p.nombre as plan,
                i.fecha_instalacion as fecha,
                i.estado
            FROM instalaciones i
            JOIN clientes c ON i.cliente_id = c.id
            JOIN planes p ON i.plan_id = p.id
            ORDER BY i.fecha_instalacion DESC
            LIMIT 5
        `);

        res.json({
            totalClientes,
            ingresosMensuales,
            anchoBandaTotal,
            ticketsPendientes,
            ingresosAnuales,
            distribucionPlanes,
            ultimasInstalaciones: ultimasInstalacionesResult
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ 
            error: 'Error al obtener estadísticas del dashboard' 
        });
    }
});

module.exports = router; 