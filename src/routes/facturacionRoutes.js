const express = require('express');
const router = express.Router();
const facturacionService = require('../services/facturacionService');
const facturaModel = require('../models/facturaModel');
const facturaController = require('../controllers/facturaController');
const { verifyToken } = require('../middleware/auth');
const db = require('../config/database'); // <--- AÑADE ESTA LÍNEA

// Rutas para descuentos y prórrogas
router.post('/descuento', verifyToken, async (req, res) => {
    try {
        const { idFactura, porcentaje, motivo } = req.body;
        
        // Validar datos
        if (!idFactura || porcentaje === undefined || motivo === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Todos los campos son requeridos'
            });
        }

        // Validar porcentaje
        if (porcentaje < 0 || porcentaje > 100) {
            return res.status(400).json({
                success: false,
                error: 'El porcentaje debe estar entre 0 y 100'
            });
        }

        // Aplicar descuento usando el servicio
        const resultado = await facturacionService.aplicarDescuento(idFactura, porcentaje, motivo);

        // Si el descuento es 100%, marcar la factura como pagada
        if (parseFloat(porcentaje) === 100) {
            await facturacionService.actualizarEstadoFactura(
                idFactura,
                'pagada',
                'Descuento 100%'
            );
        }
        
        res.json({
            success: true,
            data: resultado
        });
    } catch (error) {
        console.error('Error al aplicar descuento:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
router.post('/prorroga', verifyToken, facturaController.aplicarProrroga);

// Vista principal de facturas
router.get('/', verifyToken, (req, res) => {
    try {
        res.render('facturas/index', {
            currentPage: 'facturacion',
            title: 'Facturas',
            user: req.user
        });
    } catch (error) {
        console.error('Error al cargar la página de facturas:', error);
        res.status(500).render('facturas/index', {
            currentPage: 'facturacion',
            title: 'Error',
            error: 'Error al cargar la página de facturas',
            user: req.user
        });
    }
});


// Listar todas las facturas (IMPORTANTE: esta ruta debe ir antes de las rutas con parámetros)
router.get('/list', verifyToken, async (req, res) => {
    try {
        const facturas = await facturacionService.obtenerFacturas();
        res.json(facturas);
    } catch (error) {
        console.error('Error al obtener facturas:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al obtener la lista de facturas' 
        });
    }
});

// Resumen anual por cliente y mes (pagada/pendiente/sin factura)
router.get('/resumen-anual', verifyToken, async (req, res) => {
    try {
        await facturacionService.ensureAbonosSchema();
        const anioActual = new Date().getUTCFullYear();
        const anio = Number.parseInt(req.query.anio, 10) || anioActual;
        const estadoCliente = (req.query.estado_cliente || 'activos').toString().toLowerCase();
        const soloConDeuda = String(req.query.solo_con_deuda || '0') === '1';

        let filtroEstadoSql = '';
        if (estadoCliente === 'activos') {
            filtroEstadoSql = 'AND cp.activo = 1';
        } else if (estadoCliente === 'desactivados') {
            filtroEstadoSql = 'AND cp.activo = 0';
        }

        const [rows] = await db.query(`
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

        const [deudas] = await db.query(`
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

        const deudasMap = new Map();
        for (const deuda of deudas) {
            deudasMap.set(deuda.cliente_id, Number(deuda.total_por_pagar || 0));
        }

        const clientesMap = new Map();

        for (const row of rows) {
            if (!clientesMap.has(row.cliente_id)) {
                const fechaCreacion = row.cliente_creado_en ? new Date(row.cliente_creado_en) : null;
                const anioCreacion = fechaCreacion ? fechaCreacion.getUTCFullYear() : null;
                const mesCreacion = fechaCreacion ? (fechaCreacion.getUTCMonth() + 1) : null;
                const meses = {};

                for (let mes = 1; mes <= 12; mes++) {
                    let estadoInicial = 'sin_factura';
                    if (anioCreacion !== null) {
                        if (anio < anioCreacion || (anio === anioCreacion && mes < mesCreacion)) {
                            estadoInicial = 'no_aplica';
                        }
                    }
                    meses[mes] = estadoInicial;
                }

                clientesMap.set(row.cliente_id, {
                    cliente_id: row.cliente_id,
                    cliente_nombre: row.cliente_nombre,
                    cliente_apellido: row.cliente_apellido,
                    cliente_activo: row.cliente_activo === 1,
                    total_por_pagar: deudasMap.get(row.cliente_id) || 0,
                    meses
                });
            }

            if (row.mes_numero >= 1 && row.mes_numero <= 12) {
                const estadoMes = row.pagada === 1 ? 'pagada' : (row.total_facturas_mes > 0 ? 'pendiente' : 'sin_factura');
                clientesMap.get(row.cliente_id).meses[row.mes_numero] = estadoMes;
            }
        }

        let data = Array.from(clientesMap.values());
        if (soloConDeuda) {
            data = data.filter(item => Number(item.total_por_pagar || 0) > 0);
        }
        const granTotalPorPagar = data.reduce((acc, item) => acc + Number(item.total_por_pagar || 0), 0);

        res.json({
            success: true,
            anio,
            estado_cliente: estadoCliente,
            solo_con_deuda: soloConDeuda,
            gran_total_por_pagar: granTotalPorPagar,
            data
        });
    } catch (error) {
        console.error('Error al obtener resumen anual de facturación:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener el resumen anual de facturación'
        });
    }
});

// Vista de resumen anual
router.get('/resumen-anual/vista', verifyToken, (req, res) => {
    try {
        res.render('facturas/resumen-anual', {
            currentPage: 'facturacion',
            title: 'Resumen Anual de Facturación',
            user: req.user
        });
    } catch (error) {
        console.error('Error al cargar la vista de resumen anual:', error);
        res.status(500).render('error', {
            currentPage: 'facturacion',
            title: 'Error',
            error: 'No se pudo cargar la vista de resumen anual',
            user: req.user
        });
    }
});

// Obtener facturas de un cliente
router.get('/cliente/:id', verifyToken, async (req, res) => {
    try {
        const facturas = await facturacionService.obtenerFacturasCliente(req.params.id);
        res.json(facturas);
    } catch (error) {
        console.error('Error al obtener facturas:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al obtener las facturas del cliente' 
        });
    }
});

// Vista detallada de una factura
router.get('/:id/ver', verifyToken, async (req, res) => {
    try {
        const factura = await facturacionService.obtenerFactura(req.params.id);
        if (!factura) {
            return res.redirect('/facturacion');
        }
        res.render('facturas/ver', { 
            factura,
            currentPage: 'facturacion',
            title: 'Ver Facturas',
            user: req.user
        });
    } catch (error) {
        console.error('Error al obtener factura:', error);
        res.redirect('/facturacion');
    }
});

// Generar facturas mensuales
router.post('/generar-mensual', verifyToken, async (req, res) => {
    try {
        const { fecha } = req.body;
        const resultado = await facturacionService.generarFacturasMensuales(true, fecha);
        res.json(resultado);
    } catch (error) {
        console.error('Error al generar facturas:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al generar las facturas mensuales' 
        });
    }
});

// Actualizar estado de factura
router.put('/:id/estado', verifyToken, async (req, res) => {
    try {
        const { estado, metodo_pago } = req.body;
        
        if (!['pendiente', 'pagada', 'vencida'].includes(estado)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Estado de factura inválido' 
            });
        }

        const resultado = await facturacionService.actualizarEstadoFactura(
            req.params.id,
            estado,
            metodo_pago
        );

        res.json(resultado);
    } catch (error) {
        console.error('Error al actualizar estado de factura:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al actualizar el estado de la factura' 
        });
    }
});

// Registrar pago de factura
router.post('/:id/pago', verifyToken, async (req, res) => {
    try {
        const { id: facturaId } = req.params; 
        const usuario = req.session.user;
        const { metodo_pago, monto_recibido, monto } = req.body;

        // Llama al servicio que ahora contiene toda la lógica
        const resultado = await facturacionService.registrarPagoFactura(facturaId, usuario, {
            metodo_pago,
            monto_recibido: monto_recibido ?? monto
        });

        if (resultado.success) {
            res.json({ success: true, message: resultado.message, data: resultado.data });
        } else {
            // Si el servicio manejara errores específicos, podrías ponerlos aquí
            res.status(400).json({ error: resultado.message || 'No se pudo registrar el pago.' });
        }

    } catch (error) {
        console.error('Error al registrar pago:', error);
        res.status(500).json({ error: 'Error interno del servidor al registrar el pago.' });
    }
});

module.exports = router;
