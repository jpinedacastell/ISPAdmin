const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../config/database');
const multer = require('multer');
const path = require('path');

let cacheSoportaCodigoTicket = null;

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

async function soportaCodigoTicket() {
    if (cacheSoportaCodigoTicket !== null) return cacheSoportaCodigoTicket;
    const [rows] = await db.query(`
        SELECT COUNT(*) AS total
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'tickets'
          AND COLUMN_NAME = 'codigo_ticket'
    `);
    cacheSoportaCodigoTicket = rows[0].total > 0;
    return cacheSoportaCodigoTicket;
}

// RUTA PARA MOSTRAR EL FORMULARIO DE NUEVO TICKET
router.get('/nuevo', verifyToken, async (req, res) => {
    try {
        // Clientes con plan activo vigente
        const [clientes] = await db.query(`
            SELECT DISTINCT c.id, c.nombre, c.apellido
            FROM clientes c
            INNER JOIN cliente_plan cp ON cp.cliente_id = c.id
            WHERE cp.activo = 1
              AND cp.fecha_fin IS NULL
            ORDER BY c.nombre, c.apellido
        `);
        
        res.render('tickets/nuevo', {
            title: 'Crear Nuevo Ticket',
            currentPage: 'tickets',
            clientes: clientes,
            user: req.session.user,
            csrfToken: req.csrfToken() // Asegúrate de pasar el token CSRF si lo usas
        });
    } catch (error) {
        console.error("Error al cargar el formulario de nuevo ticket:", error);
        req.flash('error_msg', 'No se pudo cargar el formulario.');
        res.redirect('/tickets');
    }
});

// RUTA FALTANTE: GET /tickets - Muestra la lista de todos los tickets
router.get('/', verifyToken, async (req, res) => {
    try {
        const usaCodigoTicket = await soportaCodigoTicket();
        const codigoExpr = usaCodigoTicket
            ? `COALESCE(t.codigo_ticket, CONCAT('TCK-', DATE_FORMAT(t.created_at, '%Y%m'), '-', LPAD(t.id, 5, '0')))`
            : `CONCAT('TCK-', DATE_FORMAT(t.created_at, '%Y%m'), '-', LPAD(t.id, 5, '0'))`;

        const [tickets] = await db.query(`
            SELECT 
                t.id, t.asunto, t.estado, t.prioridad, t.created_at,
                ${codigoExpr} AS ticket_codigo,
                c.nombre as cliente_nombre, c.apellido as cliente_apellido
            FROM tickets t
            JOIN clientes c ON t.cliente_id = c.id
            ORDER BY t.created_at DESC
        `);

        res.render('tickets/index', { // Asume que la vista se llama index.ejs
            title: 'Gestión de Tickets',
            currentPage: 'tickets',
            tickets: tickets,
            user: req.session.user
        });
    } catch (error) {
        console.error("Error al obtener la lista de tickets:", error);
        req.flash('error_msg', 'No se pudo cargar la lista de tickets.');
        res.redirect('/dashboard'); // Redirigir a un lugar seguro en caso de error
    }
});

// GET /tickets/servicios-catalogo - API para listar todos los servicios cobrables
router.get('/servicios-catalogo', verifyToken, async (req, res) => {
    try {
        const [servicios] = await db.query('SELECT * FROM servicios_catalogo WHERE activo = 1 ORDER BY nombre');
        res.json(servicios);
    } catch (error) {
        console.error('Error al listar servicios del catálogo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// RUTA PARA MOSTRAR LOS DETALLES DE UN TICKET (ACTUALIZADA)
router.get('/:id(\\d+)', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const usaCodigoTicket = await soportaCodigoTicket();
        const codigoExpr = usaCodigoTicket
            ? `COALESCE(t.codigo_ticket, CONCAT('TCK-', DATE_FORMAT(t.created_at, '%Y%m'), '-', LPAD(t.id, 5, '0')))`
            : `CONCAT('TCK-', DATE_FORMAT(t.created_at, '%Y%m'), '-', LPAD(t.id, 5, '0'))`;
        // 1. Obtener datos del ticket
        const [ticketData] = await db.query(`
            SELECT 
                t.*,
                ${codigoExpr} AS ticket_codigo,
                c.nombre as cliente_nombre, c.apellido as cliente_apellido
            FROM tickets t
            JOIN clientes c ON t.cliente_id = c.id
            WHERE t.id = ?
        `, [id]);

        if (ticketData.length === 0) {
            req.flash('error_msg', 'Ticket no encontrado.');
            return res.redirect('/tickets');
        }

        // 2. Obtener comentarios del ticket (existente)
        const [comentarios] = await db.query(`
            SELECT tc.*, a.nombre as autor_nombre
            FROM ticket_comentarios tc
            JOIN administradores a ON tc.usuario_id = a.id
            WHERE tc.ticket_id = ?
            ORDER BY tc.created_at DESC
        `, [id]);

        // 3. OBTENER SERVICIOS/COSTOS ASOCIADOS (NUEVO)
        const [servicios] = await db.query(`
            SELECT ts.id, ts.cantidad, ts.precio_unitario, sc.nombre
            FROM ticket_servicios ts
            JOIN servicios_catalogo sc ON ts.servicio_id = sc.id
            WHERE ts.ticket_id = ?
        `, [id]);

        const [costos] = await db.query(`
            SELECT id, descripcion, monto
            FROM ticket_costos
            WHERE ticket_id = ?
            ORDER BY id DESC
        `, [id]);

        const totalServicios = servicios.reduce((acc, s) => acc + (Number(s.cantidad) * Number(s.precio_unitario)), 0);
        const totalCostos = costos.reduce((acc, c) => acc + Number(c.monto), 0);
        const totalTicket = totalServicios + totalCostos;

        res.render('tickets/detalle', {
            title: `Ticket ${ticketData[0].ticket_codigo}`,
            currentPage: 'tickets',
            ticket: ticketData[0],
            comentarios: comentarios,
            servicios: servicios, // <-- Pasar los servicios a la vista
            costos: costos,
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
        // Ahora req.body.comentario y req.file estarán disponibles
        const { id: ticket_id } = req.params;
        const { comentario } = req.body;
        const usuario_id = req.session.user.id;
        const foto_url = req.file ? `/uploads/tickets/${req.file.filename}` : null;

        await db.query(
            'INSERT INTO ticket_comentarios (ticket_id, usuario_id, comentario, foto_url) VALUES (?, ?, ?, ?)',
            [ticket_id, usuario_id, comentario, foto_url]
        );

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
        const [insertResult] = await db.query(
            'INSERT INTO ticket_costos (ticket_id, descripcion, monto) VALUES (?, ?, ?)',
            [id, descripcion, monto]
        );

        const [[totalesServicios]] = await db.query(
            'SELECT COALESCE(SUM(cantidad * precio_unitario), 0) AS total_servicios FROM ticket_servicios WHERE ticket_id = ?',
            [id]
        );
        const [[totalesCostos]] = await db.query(
            'SELECT COALESCE(SUM(monto), 0) AS total_costos FROM ticket_costos WHERE ticket_id = ?',
            [id]
        );

        const totalServicios = Number(totalesServicios.total_servicios || 0);
        const totalCostos = Number(totalesCostos.total_costos || 0);
        const totalTicket = totalServicios + totalCostos;

        res.json({
            success: true,
            message: 'Costo agregado correctamente.',
            costo: {
                id: insertResult.insertId,
                descripcion,
                monto: Number(monto)
            },
            totales: {
                total_servicios: totalServicios,
                total_costos: totalCostos,
                total_ticket: totalTicket
            }
        });
    } catch (error) {
        console.error("Error al agregar costo al ticket:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

// Ruta para ELIMINAR un costo de un ticket
router.delete('/costos/:costo_id', verifyToken, async (req, res) => {
    const { costo_id } = req.params;
    
    try {
        const [costoRows] = await db.query('SELECT ticket_id FROM ticket_costos WHERE id = ?', [costo_id]);
        if (!costoRows.length) {
            return res.status(404).json({ success: false, error: 'Costo no encontrado.' });
        }
        const ticketId = costoRows[0].ticket_id;

        await db.query('DELETE FROM ticket_costos WHERE id = ?', [costo_id]);

        const [[totalesServicios]] = await db.query(
            'SELECT COALESCE(SUM(cantidad * precio_unitario), 0) AS total_servicios FROM ticket_servicios WHERE ticket_id = ?',
            [ticketId]
        );
        const [[totalesCostos]] = await db.query(
            'SELECT COALESCE(SUM(monto), 0) AS total_costos FROM ticket_costos WHERE ticket_id = ?',
            [ticketId]
        );

        const totalServicios = Number(totalesServicios.total_servicios || 0);
        const totalCostos = Number(totalesCostos.total_costos || 0);
        const totalTicket = totalServicios + totalCostos;

        res.json({
            success: true,
            message: 'Costo eliminado correctamente.',
            totales: {
                total_servicios: totalServicios,
                total_costos: totalCostos,
                total_ticket: totalTicket
            }
        });
    } catch (error) {
        console.error("Error al eliminar el costo:", error);
        res.status(500).json({ success: false, error: 'Error al eliminar el costo.' });
    }
});

// PUT /tickets/:id/estado - actualizar estado y prioridad de ticket
router.put('/:id(\\d+)/estado', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, prioridad } = req.body;

        const estadosValidos = ['pendiente', 'abierto', 'en_proceso', 'resuelto', 'cerrado'];
        const prioridadesValidas = ['baja', 'media', 'alta'];

        if (!estadosValidos.includes(estado) || !prioridadesValidas.includes(prioridad)) {
            return res.status(400).json({ success: false, error: 'Estado o prioridad inválidos.' });
        }

        const [result] = await db.query(
            'UPDATE tickets SET estado = ?, prioridad = ? WHERE id = ?',
            [estado, prioridad, id]
        );

        if (result.affectedRows === 0) {
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
    const connection = await db.getConnection();
    try {
        // El frontend enviará los datos del ticket y un array 'servicios'
        const { cliente_id, asunto, descripcion, prioridad, servicios } = req.body;

        await connection.beginTransaction();

        // 1. Crear el ticket principal
        const [ticketResult] = await connection.query(
            'INSERT INTO tickets (cliente_id, asunto, descripcion, prioridad, usuario_apertura_id) VALUES (?, ?, ?, ?, ?)',
            [cliente_id, asunto, descripcion, prioridad, req.session.user.id]
        );
        const ticketId = ticketResult.insertId;
        const [ticketRow] = await connection.query('SELECT created_at FROM tickets WHERE id = ?', [ticketId]);
        const createdAt = ticketRow[0]?.created_at ? new Date(ticketRow[0].created_at) : new Date();
        const yyyymm = `${createdAt.getUTCFullYear()}${String(createdAt.getUTCMonth() + 1).padStart(2, '0')}`;
        const codigoTicket = `TCK-${yyyymm}-${String(ticketId).padStart(5, '0')}`;
        if (await soportaCodigoTicket()) {
            await connection.query(
                'UPDATE tickets SET codigo_ticket = ? WHERE id = ?',
                [codigoTicket, ticketId]
            );
        }

        let costoTotal = 0;

        // 2. Procesar y guardar los servicios asociados (si existen)
        if (servicios && servicios.length > 0) {
            for (const item of servicios) {
                // Obtener el precio actual del catálogo para asegurar consistencia
                const [servicioInfo] = await connection.query('SELECT precio FROM servicios_catalogo WHERE id = ?', [item.servicio_id]);
                const precioUnitario = servicioInfo[0].precio;
                
                await connection.query(
                    'INSERT INTO ticket_servicios (ticket_id, servicio_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
                    [ticketId, item.servicio_id, item.cantidad, precioUnitario]
                );
                costoTotal += item.cantidad * precioUnitario;
            }
        }

        // 3. Actualizar el costo total en el ticket
        if (costoTotal > 0) {
            await connection.query('UPDATE tickets SET costo_total = ? WHERE id = ?', [costoTotal, ticketId]);
        }

        await connection.commit();
        res.status(201).json({ success: true, message: 'Ticket creado correctamente', ticketId });

    } catch (error) {
        await connection.rollback();
        console.error('Error al crear ticket:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        connection.release();
    }
});

// RUTA PARA AÑADIR UN SERVICIO A UN TICKET EXISTENTE (NUEVO)
router.post('/:id/servicios', verifyToken, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { id: ticket_id } = req.params;
        const { servicio_id, cantidad, nuevo_servicio_nombre, nuevo_servicio_precio } = req.body;
        const cantidadNum = Number(cantidad);
        const precioNuevoNum = Number(nuevo_servicio_precio);

        if (!cantidadNum || cantidadNum <= 0) {
            return res.status(400).json({ success: false, error: 'Cantidad inválida.' });
        }

        await connection.beginTransaction();

        let servicioIdFinal = Number(servicio_id) || null;
        let precioUnitario = null;

        // Si no seleccionaron un servicio, permitir crear uno nuevo al vuelo
        if (!servicioIdFinal) {
            const nombreNuevo = (nuevo_servicio_nombre || '').trim();
            if (!nombreNuevo) {
                throw new Error('Seleccione un servicio o ingrese uno nuevo.');
            }
            if (!precioNuevoNum || precioNuevoNum <= 0) {
                throw new Error('Ingrese un precio válido para el nuevo servicio.');
            }

            // Reusar si ya existe por nombre, o crearlo si no existe
            const [existente] = await connection.query(
                'SELECT id, precio FROM servicios_catalogo WHERE LOWER(nombre) = LOWER(?) LIMIT 1',
                [nombreNuevo]
            );

            if (existente.length) {
                servicioIdFinal = existente[0].id;
                precioUnitario = Number(existente[0].precio);
            } else {
                const [insertServicio] = await connection.query(
                    'INSERT INTO servicios_catalogo (nombre, precio, activo) VALUES (?, ?, 1)',
                    [nombreNuevo, precioNuevoNum]
                );
                servicioIdFinal = insertServicio.insertId;
                precioUnitario = precioNuevoNum;
            }
        } else {
            const [servicioInfo] = await connection.query(
                'SELECT precio FROM servicios_catalogo WHERE id = ? AND activo = 1',
                [servicioIdFinal]
            );
            if (!servicioInfo.length) {
                throw new Error('Servicio no encontrado o inactivo.');
            }
            precioUnitario = Number(servicioInfo[0].precio);
        }

        const [insertTicketServicio] = await connection.query(
            'INSERT INTO ticket_servicios (ticket_id, servicio_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
            [ticket_id, servicioIdFinal, cantidadNum, precioUnitario]
        );

        const [servicioNombreRow] = await connection.query(
            'SELECT nombre FROM servicios_catalogo WHERE id = ? LIMIT 1',
            [servicioIdFinal]
        );
        const servicioNombre = servicioNombreRow[0]?.nombre || 'Servicio';

        // Recalcular y actualizar el costo total del ticket
        await connection.query(`
            UPDATE tickets t
            SET costo_total = (SELECT SUM(cantidad * precio_unitario) FROM ticket_servicios WHERE ticket_id = t.id)
            WHERE t.id = ?
        `, [ticket_id]);

        const [[totalesServicios]] = await connection.query(
            'SELECT COALESCE(SUM(cantidad * precio_unitario), 0) AS total_servicios FROM ticket_servicios WHERE ticket_id = ?',
            [ticket_id]
        );
        const [[totalesCostos]] = await connection.query(
            'SELECT COALESCE(SUM(monto), 0) AS total_costos FROM ticket_costos WHERE ticket_id = ?',
            [ticket_id]
        );

        const totalServicios = Number(totalesServicios.total_servicios || 0);
        const totalCostos = Number(totalesCostos.total_costos || 0);
        const totalTicket = totalServicios + totalCostos;

        await connection.commit();
        res.json({
            success: true,
            message: 'Servicio añadido correctamente.',
            servicio: {
                id: insertTicketServicio.insertId,
                nombre: servicioNombre,
                cantidad: cantidadNum,
                precio_unitario: precioUnitario,
                subtotal: cantidadNum * precioUnitario
            },
            totales: {
                total_servicios: totalServicios,
                total_costos: totalCostos,
                total_ticket: totalTicket
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error("Error al añadir servicio:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    } finally {
        connection.release();
    }
});

// RUTA PARA ELIMINAR UN SERVICIO DE UN TICKET (NUEVO)
router.delete('/servicios/:ticketServicioId', verifyToken, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { ticketServicioId } = req.params;

        await connection.beginTransaction();

        // Obtener el ticket_id antes de borrar para poder recalcular el total
        const [itemData] = await connection.query('SELECT ticket_id FROM ticket_servicios WHERE id = ?', [ticketServicioId]);
        if (!itemData.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, error: 'Servicio de ticket no encontrado.' });
        }
        const ticket_id = itemData[0].ticket_id;

        await connection.query('DELETE FROM ticket_servicios WHERE id = ?', [ticketServicioId]);

        // Recalcular y actualizar el costo total del ticket
        await connection.query(`
            UPDATE tickets t
            SET costo_total = (SELECT COALESCE(SUM(cantidad * precio_unitario), 0) FROM ticket_servicios WHERE ticket_id = t.id)
            WHERE t.id = ?
        `, [ticket_id]);

        const [[totalesServicios]] = await connection.query(
            'SELECT COALESCE(SUM(cantidad * precio_unitario), 0) AS total_servicios FROM ticket_servicios WHERE ticket_id = ?',
            [ticket_id]
        );
        const [[totalesCostos]] = await connection.query(
            'SELECT COALESCE(SUM(monto), 0) AS total_costos FROM ticket_costos WHERE ticket_id = ?',
            [ticket_id]
        );

        const totalServicios = Number(totalesServicios.total_servicios || 0);
        const totalCostos = Number(totalesCostos.total_costos || 0);
        const totalTicket = totalServicios + totalCostos;

        await connection.commit();
        res.json({
            success: true,
            message: 'Servicio eliminado correctamente.',
            totales: {
                total_servicios: totalServicios,
                total_costos: totalCostos,
                total_ticket: totalTicket
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error("Error al eliminar servicio:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    } finally {
        connection.release();
    }
});

// RUTA PARA ACTUALIZAR PRECIO UNITARIO DE UN SERVICIO EN TICKET
router.put('/servicios/:ticketServicioId', verifyToken, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { ticketServicioId } = req.params;
        const precioUnitario = Number(req.body.precio_unitario);

        if (!precioUnitario || precioUnitario <= 0) {
            return res.status(400).json({ success: false, error: 'Precio unitario inválido.' });
        }

        await connection.beginTransaction();

        const [itemData] = await connection.query(
            'SELECT ticket_id, cantidad FROM ticket_servicios WHERE id = ?',
            [ticketServicioId]
        );

        if (!itemData.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, error: 'Servicio de ticket no encontrado.' });
        }

        const ticketId = itemData[0].ticket_id;
        const cantidad = Number(itemData[0].cantidad || 0);

        await connection.query(
            'UPDATE ticket_servicios SET precio_unitario = ? WHERE id = ?',
            [precioUnitario, ticketServicioId]
        );

        await connection.query(`
            UPDATE tickets t
            SET costo_total = (SELECT COALESCE(SUM(cantidad * precio_unitario), 0) FROM ticket_servicios WHERE ticket_id = t.id)
            WHERE t.id = ?
        `, [ticketId]);

        const [[totalesServicios]] = await connection.query(
            'SELECT COALESCE(SUM(cantidad * precio_unitario), 0) AS total_servicios FROM ticket_servicios WHERE ticket_id = ?',
            [ticketId]
        );
        const [[totalesCostos]] = await connection.query(
            'SELECT COALESCE(SUM(monto), 0) AS total_costos FROM ticket_costos WHERE ticket_id = ?',
            [ticketId]
        );

        const totalServicios = Number(totalesServicios.total_servicios || 0);
        const totalCostos = Number(totalesCostos.total_costos || 0);
        const totalTicket = totalServicios + totalCostos;

        await connection.commit();
        return res.json({
            success: true,
            message: 'Precio unitario actualizado.',
            item: {
                id: Number(ticketServicioId),
                precio_unitario: precioUnitario,
                subtotal: cantidad * precioUnitario
            },
            totales: {
                total_servicios: totalServicios,
                total_costos: totalCostos,
                total_ticket: totalTicket
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al actualizar precio unitario:', error);
        return res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    } finally {
        connection.release();
    }
});


module.exports = router;
