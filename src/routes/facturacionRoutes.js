const express = require('express');
const router = express.Router();
const facturacionService = require('../services/facturacionService');
const facturaController = require('../controllers/facturaController');
const { verifyToken } = require('../middleware/auth');

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
        const anioActual = new Date().getUTCFullYear();
        const anio = Number.parseInt(req.query.anio, 10) || anioActual;
        const estadoCliente = (req.query.estado_cliente || 'activos').toString().toLowerCase();
        const soloConDeuda = String(req.query.solo_con_deuda || '0') === '1';

        const { data, granTotalPorPagar } = await facturacionService.resumenAnual(anio, estadoCliente, soloConDeuda);

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
