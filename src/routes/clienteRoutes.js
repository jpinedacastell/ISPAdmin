const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { HTTP_STATUS } = require('../constants/http');
const { ClienteId, ClienteIdInvalidoError } = require('../domain/clientes/ClienteId');
const { normalizarDatosCliente, validarDatosCliente } = require('../domain/clientes/datosCliente');
const { TIPO_RESULTADO } = require('../domain/clientes/ResultadoEliminacion');
const { RESULTADO_ESTADO } = require('../services/clientes/ClienteService');
const clienteService = require('../services/clientes');

// Ruta para listar clientes
router.get('/', verifyToken, async (req, res) => {
    try {
        res.render('clientes/index', {
            title: 'Clientes',
            currentPage: 'clientes'
        });
    } catch (error) {
        console.error('Error al cargar la lista de clientes:', error);
        res.status(500).send('Error al cargar la lista de clientes');
    }
});

// API para obtener lista de clientes
router.get('/list', verifyToken, async (req, res) => {
    try {
        res.json(await clienteService.listar());
    } catch (error) {
        console.error('Error al obtener clientes:', error);
        res.status(500).json({ error: 'Error al obtener la lista de clientes' });
    }
});

// Ruta para mostrar formulario de nuevo cliente (DEBE IR ANTES DE /:id)
router.get('/nuevo', verifyToken, async (req, res) => {
    try {
        const planes = await clienteService.planesActivos();

        res.render('clientes/nuevo', {
            title: 'Nuevo Cliente',
            currentPage: 'clientes',
            planes: planes || []
        });
    } catch (error) {
        console.error('Error al cargar el formulario de nuevo cliente:', error);
        res.status(500).json({ error: 'Error al cargar el formulario' });
    }
});

// Ruta para obtener datos de edición del cliente
router.get('/:id/edit', verifyToken, async (req, res) => {
    try {
        const cliente = await clienteService.obtenerParaEdicion(req.params.id);
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        res.json(cliente);
    } catch (error) {
        console.error('Error al obtener cliente:', error);
        res.status(500).json({ error: 'Error al obtener cliente' });
    }
});

// GET /clientes/:id - Muestra la página de detalles de un cliente específico
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const detalle = await clienteService.obtenerDetalle(req.params.id);
        if (!detalle) {
            req.flash('error_msg', 'Cliente no encontrado');
            return res.redirect('/clientes');
        }

        const { cliente, facturas, estadoPago, tickets, notas } = detalle;

        let añoSeleccionado = parseInt(req.query.año);
        if (isNaN(añoSeleccionado)) {
            añoSeleccionado = facturas.length > 0 ? new Date(facturas[0].mes_facturado).getFullYear() : new Date().getFullYear();
        }

        res.render('clientes/detalle', {
            title: 'Detalles del Cliente',
            currentPage: 'clientes',
            cliente,
            facturas,
            tickets,
            notas,
            estadoPago,
            user: req.session.user,
            añoSeleccionado
        });
    } catch (error) {
        console.error('Error al obtener detalles del cliente:', error);
        req.flash('error_msg', 'No se pudieron cargar los detalles del cliente.');
        res.redirect('/clientes');
    }
});

// API para crear nuevo cliente
router.post('/', verifyToken, async (req, res) => {
    try {
        const datos = normalizarDatosCliente(req.body);

        const error = validarDatosCliente(datos, { requierePlan: true });
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error });
        }

        const resultado = await clienteService.crear(datos);
        if ('duplicado' in resultado) {
            return res.status(HTTP_STATUS.CONFLICT).json({ success: false, error: resultado.duplicado });
        }

        res.json({ success: true, clienteId: resultado.clienteId });
    } catch (error) {
        console.error('Error al crear cliente:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, error: 'Error al crear el cliente' });
    }
});

// Actualizar cliente
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const datos = normalizarDatosCliente(req.body);

        const errorValidacion = validarDatosCliente(datos, { requierePlan: false });
        if (errorValidacion) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: errorValidacion });
        }

        const resultado = await clienteService.actualizar(id, datos, req.body.plan_id);
        if ('duplicado' in resultado) {
            return res.status(HTTP_STATUS.CONFLICT).json({ success: false, error: resultado.duplicado });
        }

        res.json({
            success: true,
            message: 'Cliente actualizado correctamente',
            cliente: resultado.cliente
        });
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error al actualizar cliente'
        });
    }
});

// API para cambiar estado del cliente
const RESPUESTA_CAMBIO_ESTADO = Object.freeze({
    [RESULTADO_ESTADO.NO_ENCONTRADO]: () => ({
        status: HTTP_STATUS.NOT_FOUND,
        body: { success: false, error: 'Cliente no encontrado' }
    }),
    [RESULTADO_ESTADO.SIN_PLAN]: () => ({
        status: HTTP_STATUS.BAD_REQUEST,
        body: { success: false, error: 'El cliente no tiene un plan activo asignado' }
    }),
    [RESULTADO_ESTADO.NO_ACTUALIZADO]: () => ({
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        body: { success: false, error: 'No se pudo actualizar el estado del cliente' }
    }),
    [RESULTADO_ESTADO.CAMBIADO]: ({ activo }) => ({
        status: HTTP_STATUS.OK,
        body: {
            success: true,
            message: `Cliente ${activo ? 'activado' : 'desactivado'} correctamente`,
            activo
        }
    })
});

router.patch('/:id/toggle', verifyToken, async (req, res) => {
    try {
        const resultado = await clienteService.cambiarEstado(req.params.id);
        const { status, body } = RESPUESTA_CAMBIO_ESTADO[resultado.tipo](resultado);
        res.status(status).json(body);
    } catch (error) {
        console.error('Error al cambiar estado del cliente:', error);
        res.status(500).json({
            success: false,
            error: 'Error al cambiar estado del cliente: ' + error.message
        });
    }
});

// API para eliminar cliente
const MYSQL_FK_VIOLATION = 'ER_ROW_IS_REFERENCED_2';

const listar = (conteos) => conteos.map(({ cantidad, descripcion }) => `${cantidad} ${descripcion}`).join(', ');

// Respuesta HTTP según el resultado de la eliminación
const RESPUESTA_ELIMINACION = Object.freeze({
    [TIPO_RESULTADO.ELIMINADO]: (resultado) => ({
        status: HTTP_STATUS.OK,
        body: {
            success: true,
            message: resultado.detalle.length > 0
                ? `Cliente eliminado junto con: ${listar(resultado.detalle)}`
                : 'Cliente eliminado correctamente'
        }
    }),
    [TIPO_RESULTADO.NO_ENCONTRADO]: () => ({
        status: HTTP_STATUS.NOT_FOUND,
        body: { success: false, error: 'Cliente no encontrado' }
    }),
    [TIPO_RESULTADO.BLOQUEADO]: (resultado) => ({
        status: HTTP_STATUS.CONFLICT,
        body: {
            success: false,
            error: `No se puede eliminar: el cliente tiene ${listar(resultado.detalle)}. Desactívelo en su lugar.`,
            bloqueos: resultado.detalle
        }
    })
});

router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const resultado = await clienteService.eliminar(new ClienteId(req.params.id));

        const { status, body } = RESPUESTA_ELIMINACION[resultado.tipo](resultado);
        res.status(status).json(body);
    } catch (error) {
        if (error instanceof ClienteIdInvalidoError) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: error.message });
        }
        // Por si se creó una factura entre el conteo y el DELETE
        if (error.code === MYSQL_FK_VIOLATION) {
            return res.status(HTTP_STATUS.CONFLICT).json({
                success: false,
                error: 'No se puede eliminar: el cliente tiene registros asociados. Desactívelo en su lugar.'
            });
        }
        console.error('Error al eliminar cliente:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, error: 'Error al eliminar cliente' });
    }
});

// API para agregar nota
router.post('/:id/notas', verifyToken, async (req, res) => {
    try {
        const notaId = await clienteService.agregarNota(req.params.id, req.body.nota);

        res.json({
            success: true,
            message: 'Nota agregada exitosamente',
            nota_id: notaId
        });
    } catch (error) {
        console.error('Error al agregar nota:', error);
        res.status(500).json({ error: 'Error al agregar nota' });
    }
});

// API para eliminar nota
router.delete('/:id/notas/:nota_id', verifyToken, async (req, res) => {
    try {
        const { id, nota_id } = req.params;
        await clienteService.eliminarNota(nota_id, id);

        res.json({
            success: true,
            message: 'Nota eliminada exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar nota:', error);
        res.status(500).json({ error: 'Error al eliminar nota' });
    }
});

module.exports = router;
