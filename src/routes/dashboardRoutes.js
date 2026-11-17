// routes/dashboardRoutes.js

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../config/database');

/**
 * @route   GET /dashboard
 * @desc    Renderiza la página principal del dashboard.
 * @access  Privado
 */
router.get('/', verifyToken, (req, res) => {
    try {
        res.render('dashboard', {
            title: 'Dashboard',
            currentPage: 'dashboard',
            user: req.session.user
        });
    } catch (error) {
        console.error('Error al cargar el dashboard:', error);
        res.status(500).send('Error al cargar el dashboard');
    }
});


/**
 * @route   GET /dashboard/stats
 * @desc    Endpoint de API para obtener TODAS las estadísticas del dashboard.
 * @access  Privado
 */
router.get('/stats', verifyToken, async (req, res) => {
    try {
        // --- 1. DATOS PARA LAS TARJETAS ---
        const [clientesResult] = await db.query(`
            SELECT COUNT(DISTINCT cp.cliente_id) as total
            FROM cliente_plan cp
            WHERE cp.activo = 1
              AND cp.fecha_fin IS NULL
        `);
        const totalClientes = clientesResult[0].total;

        // Ingresos reales recibidos en caja durante el mes.
        const [ingresosResult] = await db.query(`
            SELECT COALESCE(SUM(monto), 0) as total
            FROM movimientos_financieros
            WHERE tipo = 'ingreso'
              AND MONTH(fecha) = MONTH(CURRENT_DATE())
              AND YEAR(fecha) = YEAR(CURRENT_DATE())
        `);
        const ingresosMensuales = ingresosResult[0].total;

        // Ingreso esperado del mes facturado actual (considerando descuento)
        const [esperadoResult] = await db.query(`
            SELECT COALESCE(SUM(monto - COALESCE(descuento_monto, 0)), 0) as total
            FROM facturas
            WHERE MONTH(mes_facturado) = MONTH(CURRENT_DATE()) AND YEAR(mes_facturado) = YEAR(CURRENT_DATE())
        `);
        const ingresosEsperados = esperadoResult[0].total;

        const [anchoBandaResult] = await db.query(`
            SELECT COALESCE(SUM(p.velocidad_descarga), 0) as total
            FROM cliente_plan c JOIN planes p ON c.plan_id = p.id WHERE c.activo = 1
        `);
        const anchoBandaTotal = anchoBandaResult[0].total;

        const [ticketsResult] = await db.query("SELECT COUNT(*) as total FROM tickets WHERE estado = 'pendiente'");
        const ticketsPendientes = ticketsResult[0].total;

        // --- 2. DATOS PARA EL GRÁFICO DE INGRESOS ANUALES ---
        const [ingresosPorMes] = await db.query(`
            SELECT MONTH(fecha) as mes, SUM(monto) as total
            FROM movimientos_financieros
            WHERE tipo = 'ingreso'
              AND YEAR(fecha) = YEAR(CURRENT_DATE())
            GROUP BY MONTH(fecha)
            ORDER BY mes ASC
        `);
        
        const ingresosAnuales = new Array(12).fill(0); // Crea un array de 12 ceros
        ingresosPorMes.forEach(row => {
            ingresosAnuales[row.mes - 1] = parseFloat(row.total); // Rellena el mes correspondiente
        });

        // --- 3. DATOS PARA EL GRÁFICO DE DISTRIBUCIÓN DE PLANES ---
        const [distribucion] = await db.query(`
            SELECT p.nombre, COUNT(c.id) as total
            FROM cliente_plan c
            JOIN planes p ON c.plan_id = p.id
            WHERE c.activo = 1
            GROUP BY p.nombre
        `);

        const distribucionPlanes = {};
        distribucion.forEach(row => {
            distribucionPlanes[row.nombre] = row.total;
        });

        // --- 4. DATOS PARA LA TABLA DE ÚLTIMAS INSTALACIONES ---
        const [ultimasInstalaciones] = await db.query(`
            SELECT 
                cl.nombre as cliente, 
                p.nombre as plan, 
                co.created_at as fecha, 
                (CASE WHEN co.activo = 1 THEN 'activo' ELSE 'inactivo' END) as estado
            FROM cliente_plan co
            JOIN clientes cl ON co.cliente_id = cl.id
            JOIN planes p ON co.plan_id = p.id
            ORDER BY co.created_at DESC
            LIMIT 5
        `);

        // --- 5. ENVIAR TODOS LOS DATOS JUNTOS ---
        res.json({
            // Datos para las tarjetas
            totalClientes,
            ingresosMensuales,
            ingresosEsperados,
            anchoBandaTotal,
            ticketsPendientes,
            // Datos para los gráficos y tablas
            ingresosAnuales,
            distribucionPlanes,
            ultimasInstalaciones
        });

    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ 
            error: 'Error al obtener estadísticas del dashboard' 
        });
    }
});

module.exports = router;
