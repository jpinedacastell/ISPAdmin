const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const ticketService = require('../services/tickets');

const ESTADOS_VALIDOS = ['pendiente', 'abierto', 'en_proceso', 'resuelto', 'cerrado'];
const PRIORIDADES_VALIDAS = ['baja', 'media', 'alta'];

// Configuración de Multer para la subida de fotos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/tickets/');
    },
    filename: function (req, file, cb) {
        cb(null, 'ticket-' + req.params.id + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// RUTA PARA MOSTRAR EL FORMULARIO DE NUEVO TICKET
router.get('/nuevo', verifyToken, async (req, res) => {
    try {
        // Clientes con plan activo vigente
        const clientes = await ticketService.clientesParaNuevoTicket();

        res.render('tickets/nuevo', {
            title: 'Crear Nuevo Ticket',
            currentPage: 'tickets',
            clientes: clientes,
            user: req.session.user,
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error("Error al cargar el formulario de nuevo ticket:", error);
        req.flash('error_msg', 'No se pudo cargar el formulario.');
        res.redirect('/tickets');
    }
});

// GET /tickets - Muestra la lista de todos los tickets
router.get('/', verifyToken, async (req, res) => {
    try {
        const tickets = await ticketService.listar();

        res.render('tickets/index', {
            title: 'Gestión de Tickets',
            currentPage: 'tickets',
            tickets: tickets,
            user: req.session.user
        });
    } catch (error) {
        console.error("Error al obtener la lista de tickets:", error);
        req.flash('error_msg', 'No se pudo cargar la lista de tickets.');
        res.redirect('/dashboard');
    }
});

// GET /tickets/servicios-catalogo - API para listar todos los servicios cobrables
router.get('/servicios-catalogo', verifyToken, async (req, res) => {
    try {
        res.json(await ticketService.serviciosDelCatalogo());
    } catch (error) {
        console.error('Error al listar servicios del catálogo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// RUTA PARA MOSTRAR LOS DETALLES DE UN TICKET
router.get('/:id(\\d+)', verifyToken, async (req, res) => {
    try {
        const detalle = await ticketService.detalle(req.params.id);
        if (!detalle) {
            req.flash('error_msg', 'Ticket no encontrado.');
            return res.redirect('/tickets');
        }

        const { ticket, comentarios, servicios, costos, totalServicios, totalCostos, totalTicket } = detalle;

        res.render('tickets/detalle', {
            title: `Ticket ${ticket.ticket_codigo}`,
            currentPage: 'tickets',
            ticket,
            comentarios,
            servicios,
            costos,
            totalServicios,
            totalCostos,
            totalTicket,
            user: req.session.user,
            csrfToken: req.csrfToken()
        });

    } catch (error) {
        console.error("Error al ver el ticket:", error);
        res.redirect('/tickets');
    }
});

// RUTA PARA AÑADIR UN NUEVO COMENTARIO
router.post('/:id/comentarios', 
    [verifyToken, upload.single('foto')],
    async (req, res) => {
    try {
        await ticketService.agregarComentario({
            ticketId: req.params.id,
            usuarioId: req.session.user.id,
            comentario: req.body.comentario,
            fotoUrl: req.file ? `/uploads/tickets/${req.file.filename}` : null
        });

        res.json({ success: true, message: 'Comentario añadido correctamente.' });

    } catch (error) {
        // Manejo de errores de CSRF
        if (error.code === 'EBADCSRFTOKEN') {
            return res.status(403).json({ success: false, error: 'Token CSRF inválido o ausente.' });
        }
        console.error("Error al añadir comentario:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

// Ruta para AGREGAR un nuevo costo a un ticket
router.post('/:id/costos', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { descripcion, monto } = req.body;

    if (!descripcion || !monto || parseFloat(monto) <= 0) {
        return res.status(400).json({ success: false, error: 'La descripción y un monto válido son requeridos.' });
    }

    try {
        const { costoId, totales } = await ticketService.agregarCosto(id, descripcion, monto);

        res.json({
            success: true,
            message: 'Costo agregado correctamente.',
            costo: {
                id: costoId,
                descripcion,
                monto: Number(monto)
            },
            totales
        });
    } catch (error) {
        console.error("Error al agregar costo al ticket:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

// Ruta para ELIMINAR un costo de un ticket
router.delete('/costos/:costo_id', verifyToken, async (req, res) => {
    try {
        const totales = await ticketService.eliminarCosto(req.params.costo_id);
        if (!totales) {
            return res.status(404).json({ success: false, error: 'Costo no encontrado.' });
        }

        res.json({
            success: true,
            message: 'Costo eliminado correctamente.',
            totales
        });
    } catch (error) {
        console.error("Error al eliminar el costo:", error);
        res.status(500).json({ success: false, error: 'Error al eliminar el costo.' });
    }
});

// PUT /tickets/:id/estado - actualizar estado y prioridad de ticket
router.put('/:id(\\d+)/estado', verifyToken, async (req, res) => {
    try {
        const { estado, prioridad } = req.body;

        if (!ESTADOS_VALIDOS.includes(estado) || !PRIORIDADES_VALIDAS.includes(prioridad)) {
            return res.status(400).json({ success: false, error: 'Estado o prioridad inválidos.' });
        }

        const actualizado = await ticketService.actualizarEstado(req.params.id, estado, prioridad);
        if (!actualizado) {
            return res.status(404).json({ success: false, error: 'Ticket no encontrado.' });
        }

        res.json({ success: true, message: 'Ticket actualizado correctamente.' });
    } catch (error) {
        console.error('Error al actualizar ticket:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

// POST /tickets - Crear un nuevo ticket (con servicios)
router.post('/', verifyToken, async (req, res) => {
    try {
        const ticketId = await ticketService.crear(req.body, req.session.user.id);
        res.status(201).json({ success: true, message: 'Ticket creado correctamente', ticketId });
    } catch (error) {
        console.error('Error al crear ticket:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// RUTA PARA AÑADIR UN SERVICIO A UN TICKET EXISTENTE
router.post('/:id/servicios', verifyToken, async (req, res) => {
    try {
        const { servicio_id, cantidad, nuevo_servicio_nombre, nuevo_servicio_precio } = req.body;
        const cantidadNum = Number(cantidad);

        if (!cantidadNum || cantidadNum <= 0) {
            return res.status(400).json({ success: false, error: 'Cantidad inválida.' });
        }

        const { servicio, totales } = await ticketService.agregarServicio(req.params.id, {
            servicio_id,
            cantidad: cantidadNum,
            nombreNuevo: nuevo_servicio_nombre,
            precioNuevo: Number(nuevo_servicio_precio)
        });

        res.json({
            success: true,
            message: 'Servicio añadido correctamente.',
            servicio,
            totales
        });

    } catch (error) {
        console.error("Error al añadir servicio:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

// RUTA PARA ELIMINAR UN SERVICIO DE UN TICKET
router.delete('/servicios/:ticketServicioId', verifyToken, async (req, res) => {
    try {
        const totales = await ticketService.eliminarServicio(req.params.ticketServicioId);
        if (!totales) {
            return res.status(404).json({ success: false, error: 'Servicio de ticket no encontrado.' });
        }

        res.json({
            success: true,
            message: 'Servicio eliminado correctamente.',
            totales
        });

    } catch (error) {
        console.error("Error al eliminar servicio:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

// RUTA PARA ACTUALIZAR PRECIO UNITARIO DE UN SERVICIO EN TICKET
router.put('/servicios/:ticketServicioId', verifyToken, async (req, res) => {
    try {
        const { ticketServicioId } = req.params;
        const precioUnitario = Number(req.body.precio_unitario);

        if (!precioUnitario || precioUnitario <= 0) {
            return res.status(400).json({ success: false, error: 'Precio unitario inválido.' });
        }

        const resultado = await ticketService.actualizarPrecioServicio(ticketServicioId, precioUnitario);
        if (!resultado) {
            return res.status(404).json({ success: false, error: 'Servicio de ticket no encontrado.' });
        }

        return res.json({
            success: true,
            message: 'Precio unitario actualizado.',
            item: {
                id: Number(ticketServicioId),
                precio_unitario: precioUnitario,
                subtotal: resultado.cantidad * precioUnitario
            },
            totales: resultado.totales
        });
    } catch (error) {
        console.error('Error al actualizar precio unitario:', error);
        return res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});


module.exports = router;
