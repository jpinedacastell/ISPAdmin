const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../config/database');
const facturacionService = require('../services/facturacionService');
const { HTTP_STATUS } = require('../constants/http');
const { conTransaccion } = require('../database/conTransaccion');
const { ClienteId, ClienteIdInvalidoError } = require('../domain/clientes/ClienteId');
const { normalizarDatosCliente, validarDatosCliente } = require('../domain/clientes/datosCliente');
const { TIPO_RESULTADO } = require('../domain/clientes/ResultadoEliminacion');
const { ClienteRepository } = require('../repositories/ClienteRepository');
const { EliminarClienteService } = require('../services/clientes/EliminarClienteService');

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
    let connection;
    try {
        connection = await db.getConnection();
        const [clientes] = await connection.query(`
            SELECT 
                c.*,
                cp.plan_id,
                cp.activo,
                p.nombre as plan_nombre,
                p.velocidad_descarga,
                p.velocidad_subida,
                p.precio
            FROM clientes c
            LEFT JOIN (
                SELECT cliente_id, plan_id, activo
                FROM cliente_plan
                WHERE fecha_fin IS NULL
            ) cp ON c.id = cp.cliente_id
            LEFT JOIN planes p ON cp.plan_id = p.id
            ORDER BY c.nombre, c.apellido
        `);

        res.json(clientes);
    } catch (error) {
        console.error('Error al obtener clientes:', error);
        res.status(500).json({ error: 'Error al obtener la lista de clientes' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Ruta para mostrar formulario de nuevo cliente (DEBE IR ANTES DE /:id)
router.get('/nuevo', verifyToken, async (req, res) => {
    try {
        // Obtener lista de planes activos
        const [planes] = await db.query('SELECT * FROM planes WHERE activo = true ORDER BY velocidad_descarga');
        
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
        const [clientes] = await db.query(`
            SELECT 
                c.*,
                cp.plan_id,
                cp.activo,
                cp.fecha_inicio,
                p.nombre as plan_nombre,
                p.velocidad_descarga,
                p.velocidad_subida,
                p.precio
            FROM clientes c
            LEFT JOIN cliente_plan cp ON c.id = cp.cliente_id AND cp.fecha_fin IS NULL
            LEFT JOIN planes p ON cp.plan_id = p.id
            WHERE c.id = ?
        `, [req.params.id]);
        
        if (clientes.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        
        res.json(clientes[0]);
    } catch (error) {
        console.error('Error al obtener cliente:', error);
        res.status(500).json({ error: 'Error al obtener cliente' });
    }
});

// GET /clientes/:id - Muestra la página de detalles de un cliente específico
router.get('/:id', verifyToken, async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        
        // Obtener información del cliente con su plan activo
        const [clientes] = await connection.query(`
            SELECT 
                c.*,
                cp.plan_id,
                cp.activo,
                cp.fecha_inicio,
                p.nombre as plan_nombre,
                p.velocidad_descarga,
                p.velocidad_subida,
                p.precio
            FROM clientes c
            LEFT JOIN cliente_plan cp ON c.id = cp.cliente_id AND cp.activo = 1
            LEFT JOIN planes p ON cp.plan_id = p.id
            WHERE c.id = ?
        `, [req.params.id]);
        
        if (clientes.length === 0) {
            req.flash('error_msg', 'Cliente no encontrado');
            return res.redirect('/clientes');
        }

        const cliente = clientes[0];
        await facturacionService.ensureAbonosSchema(connection);

        // CORRECCIÓN: Se añaden las columnas 'año_facturado' y 'mes_facturado_index'
        const [facturas] = await connection.query(`
            SELECT 
                id, numero_factura, cliente_id, plan_id,
                DATE_FORMAT(fecha_emision, '%Y-%m-%d') as fecha_emision,
                DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') as fecha_vencimiento,
                DATE_FORMAT(mes_facturado, '%Y-%m-01') as mes_facturado,
                CAST(monto as DECIMAL(10,2)) as monto,
                COALESCE(monto_pagado, 0) as monto_pagado,
                COALESCE(pago_recibido, 0) as pago_recibido,
                COALESCE(credito_aplicado, 0) as credito_aplicado,
                COALESCE(abono_siguiente, 0) as abono_siguiente,
                GREATEST(
                    (monto - COALESCE(descuento_monto, 0)) -
                    COALESCE(monto_pagado, 0) -
                    COALESCE(credito_aplicado, 0),
                    0
                ) as saldo_pendiente,
                estado, metodo_pago,
                YEAR(mes_facturado) as año_facturado,
                MONTH(mes_facturado) as mes_facturado_index
            FROM facturas 
            WHERE cliente_id = ? 
            ORDER BY mes_facturado DESC
        `, [req.params.id]);

        // Obtener estado de pago del cliente
        const [estadoPago] = await connection.query(`
            SELECT 
                CASE
                    WHEN COUNT(*) = 0 THEN 'sin_facturas'
                    WHEN SUM(CASE WHEN estado = 'vencida' THEN 1 ELSE 0 END) > 0 THEN 'moroso'
                    WHEN SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) > 0 THEN 'pendiente'
                    ELSE 'al_dia'
                END as estado_pago,
                COUNT(*) as total_facturas,
                SUM(CASE WHEN estado = 'pagada' THEN 1 ELSE 0 END) as facturas_pagadas,
                SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) as facturas_pendientes,
                SUM(CASE WHEN estado = 'vencida' THEN 1 ELSE 0 END) as facturas_vencidas
            FROM facturas 
            WHERE cliente_id = ?
        `, [req.params.id]);

        // Variables para datos opcionales
        let tickets = [];
        let notas = [];

        // Intentar obtener tickets si la tabla existe
        try {
            const [ticketsResult] = await connection.query(`
                SELECT * FROM tickets 
                WHERE cliente_id = ? 
                ORDER BY created_at DESC
            `, [req.params.id]);
            tickets = ticketsResult;
        } catch (error) {
            if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
        }

        // Intentar obtener notas si la tabla existe
        try {
            const [notasResult] = await connection.query(`
                SELECT * FROM notas_cliente 
                WHERE cliente_id = ? 
                ORDER BY created_at DESC
            `, [req.params.id]);
            notas = notasResult;
        } catch (error) {
            if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
        }
        
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
            estadoPago: estadoPago[0],
            user: req.session.user,
            añoSeleccionado
        });
    } catch (error) {
        console.error('Error al obtener detalles del cliente:', error);
        req.flash('error_msg', 'No se pudieron cargar los detalles del cliente.');
        res.redirect('/clientes');
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// API para crear nuevo cliente
router.post('/', verifyToken, async (req, res) => {
    let connection;
    try {
        const datos = normalizarDatosCliente(req.body);

        const error = validarDatosCliente(datos, { requierePlan: true });
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const duplicado = await new ClienteRepository(connection).buscarDuplicado(datos);
        if (duplicado) {
            await connection.rollback();
            return res.status(HTTP_STATUS.CONFLICT).json({ success: false, error: duplicado });
        }

        const [result] = await connection.query(
            'INSERT INTO clientes (nombre, apellido, dni, email, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?)',
            [datos.nombre, datos.apellido, datos.dni, datos.email, datos.telefono, datos.direccion]
        );

        await connection.query(
            'INSERT INTO cliente_plan (cliente_id, plan_id, fecha_inicio, activo) VALUES (?, ?, NOW(), true)',
            [result.insertId, datos.plan_id]
        );

        await connection.commit();
        res.json({ success: true, clienteId: result.insertId });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error al crear cliente:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, error: 'Error al crear el cliente' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Actualizar cliente
router.put('/:id', verifyToken, async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const { plan_id } = req.body;
        const datos = normalizarDatosCliente(req.body);

        const errorValidacion = validarDatosCliente(datos, { requierePlan: false });
        if (errorValidacion) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: errorValidacion });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            const duplicado = await new ClienteRepository(connection).buscarDuplicado(datos, Number(id));
            if (duplicado) {
                await connection.rollback();
                return res.status(HTTP_STATUS.CONFLICT).json({ success: false, error: duplicado });
            }

            // Actualizar datos del cliente
            await connection.query(
                `UPDATE clientes 
                 SET nombre = ?, 
                     apellido = ?, 
                     dni = ?,
                     email = ?, 
                     telefono = ?, 
                     direccion = ?
                 WHERE id = ?`,
                [datos.nombre, datos.apellido, datos.dni, datos.email, datos.telefono, datos.direccion, id]
            );

            // Manejar actualización del plan
            if (plan_id !== undefined) {
                // Obtener plan actual
                const [currentPlan] = await connection.query(
                    'SELECT plan_id FROM cliente_plan WHERE cliente_id = ? AND fecha_fin IS NULL',
                    [id]
                );

                // Solo actualizar si el plan ha cambiado
                if ((!currentPlan[0] && plan_id) || (currentPlan[0] && currentPlan[0].plan_id !== parseInt(plan_id))) {
                    // Finalizar plan actual si existe
                    if (currentPlan[0]) {
                        await connection.query(
                            `UPDATE cliente_plan 
                             SET fecha_fin = CURRENT_DATE(), activo = false
                             WHERE cliente_id = ? AND fecha_fin IS NULL`,
                            [id]
                        );
                    }

                    // Insertar nuevo plan si se proporciona uno
                    if (plan_id) {
                        await connection.query(
                            `INSERT INTO cliente_plan (cliente_id, plan_id, fecha_inicio, activo)
                             VALUES (?, ?, CURRENT_DATE(), true)`,
                            [id, plan_id]
                        );
                    }
                }
            }

            await connection.commit();

            // Obtener cliente actualizado
            const [clientes] = await connection.query(`
                SELECT c.*, 
                       cp.plan_id,
                       cp.activo,
                       cp.fecha_inicio,
                       p.nombre as plan_nombre,
                       p.velocidad_descarga,
                       p.velocidad_subida,
                       p.precio
                FROM clientes c
                LEFT JOIN cliente_plan cp ON c.id = cp.cliente_id AND cp.fecha_fin IS NULL
                LEFT JOIN planes p ON cp.plan_id = p.id
                WHERE c.id = ?
            `, [id]);

            res.json({
                success: true,
                message: 'Cliente actualizado correctamente',
                cliente: clientes[0]
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        res.status(500).json({ 
            success: false,
            error: error.message || 'Error al actualizar cliente' 
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// API para cambiar estado del cliente
router.patch('/:id/toggle', verifyToken, async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        
        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Verificar si el cliente existe
            const [cliente] = await connection.query(
                'SELECT id FROM clientes WHERE id = ?',
                [id]
            );

            if (cliente.length === 0) {
                await connection.rollback();
                return res.status(404).json({ 
                    success: false,
                    error: 'Cliente no encontrado' 
                });
            }

            // Obtener el estado actual del cliente y su plan
            const [clientePlanes] = await connection.query(
                'SELECT cp.id, cp.activo, cp.plan_id FROM cliente_plan cp WHERE cp.cliente_id = ? AND cp.fecha_fin IS NULL',
                [id]
            );
            
            if (clientePlanes.length === 0) {
                await connection.rollback();
                return res.status(400).json({ 
                    success: false,
                    error: 'El cliente no tiene un plan activo asignado' 
                });
            }

            // Cambiar el estado
            const nuevoEstado = !clientePlanes[0].activo;
            
            const result = await connection.query(
                'UPDATE cliente_plan SET activo = ? WHERE id = ? AND cliente_id = ? AND fecha_fin IS NULL',
                [nuevoEstado, clientePlanes[0].id, id]
            );

            if (result[0].affectedRows === 0) {
                await connection.rollback();
                return res.status(500).json({ 
                    success: false,
                    error: 'No se pudo actualizar el estado del cliente' 
                });
            }

            await connection.commit();
            
            res.json({ 
                success: true, 
                message: `Cliente ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`,
                activo: nuevoEstado
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error al cambiar estado del cliente:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error al cambiar estado del cliente: ' + error.message 
        });
    } finally {
        if (connection) {
            connection.release();
        }
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
        const clienteId = new ClienteId(req.params.id);

        const resultado = await conTransaccion(db, (conexion) =>
            new EliminarClienteService({ clienteRepository: new ClienteRepository(conexion) }).ejecutar(clienteId)
        );

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
        const { id } = req.params;
        const { nota } = req.body;

        const [result] = await db.query(
            'INSERT INTO notas_cliente (cliente_id, nota, fecha_creacion) VALUES (?, ?, CURRENT_TIMESTAMP)',
            [id, nota]
        );

        res.json({
            success: true,
            message: 'Nota agregada exitosamente',
            nota_id: result.insertId
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

        await db.query(
            'DELETE FROM notas_cliente WHERE id = ? AND cliente_id = ?',
            [nota_id, id]
        );

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
