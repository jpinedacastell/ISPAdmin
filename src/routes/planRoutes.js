const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../config/database');

// Ruta para listar planes
router.get('/', verifyToken, async (req, res) => {
    try {
        res.render('planes/index', {
            currentPage: 'planes',
            title: 'Planes de Internet',
            user: req.user
        });
    } catch (error) {
        console.error('Error al cargar la lista de planes:', error);
        res.status(500).send('Error al cargar la lista de planes');
    }
});

// Obtener todos los planes
router.get('/list', verifyToken, async (req, res) => {
    try {
        const [planes] = await db.query('SELECT * FROM planes ORDER BY velocidad_descarga');
        res.json(planes);
    } catch (error) {
        console.error('Error al obtener planes:', error);
        res.status(500).json({ error: 'Error al obtener planes' });
    }
});

// Obtener un plan específico
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const [planes] = await db.query('SELECT * FROM planes WHERE id = ?', [req.params.id]);
        
        if (planes.length === 0) {
            return res.status(404).json({ error: 'Plan no encontrado' });
        }
        
        res.json(planes[0]);
    } catch (error) {
        console.error('Error al obtener el plan:', error);
        res.status(500).json({ error: 'Error al obtener el plan' });
    }
});

// Actualizar un plan
router.put('/:id', verifyToken, async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const { nombre, velocidad_descarga, velocidad_subida, precio, descripcion } = req.body;

        // Validar datos
        if (!nombre || !velocidad_descarga || !velocidad_subida || !precio) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }

        // Obtener conexión del pool
        connection = await db.getConnection();

        // Iniciar transacción
        await connection.beginTransaction();

        try {
            // Actualizar plan
            await connection.query(
                `UPDATE planes 
                 SET nombre = ?, 
                     velocidad_descarga = ?, 
                     velocidad_subida = ?, 
                     precio = ?, 
                     descripcion = ?
                 WHERE id = ?`,
                [nombre, velocidad_descarga, velocidad_subida, precio, descripcion, id]
            );

            // Confirmar transacción
            await connection.commit();

            // Obtener el plan actualizado
            const [planes] = await connection.query('SELECT * FROM planes WHERE id = ?', [id]);
            
            res.json({ 
                success: true, 
                message: 'Plan actualizado correctamente',
                plan: planes[0]
            });
        } catch (error) {
            // Revertir transacción en caso de error
            if (connection) await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error al actualizar el plan:', error);
        res.status(500).json({ error: 'Error al actualizar el plan' });
    } finally {
        // Liberar la conexión
        if (connection) connection.release();
    }
});

// Activar/desactivar plan
router.patch('/:id/toggle', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Obtener el estado actual del plan
        const [planes] = await db.query('SELECT activo FROM planes WHERE id = ?', [id]);
        
        if (planes.length === 0) {
            return res.status(404).json({ error: 'Plan no encontrado' });
        }

        // Cambiar el estado
        const nuevoEstado = !planes[0].activo;
        
        await db.query('UPDATE planes SET activo = ? WHERE id = ?', [nuevoEstado, id]);
        
        res.json({ 
            success: true, 
            message: `Plan ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`,
            activo: nuevoEstado
        });
    } catch (error) {
        console.error('Error al cambiar estado del plan:', error);
        res.status(500).json({ error: 'Error al cambiar estado del plan' });
    }
});

module.exports = router; 