const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../config/database');

// Ruta principal para mostrar la vista de gestión de reportes
router.get('/', verifyToken, (req, res) => {
    res.render('reportes/index', {
        title: 'Gestión de Reportes',
        currentPage: 'reportes',
        user: req.session.user
    });
});

// API para obtener la lista de todos los reportes para DataTables
router.get('/list', verifyToken, async (req, res) => {
    try {
        const [reportes] = await db.query(`
            SELECT 
                r.id,
                r.tipo_reporte,
                r.descripcion,
                r.estado,
                r.created_at,
                c.nombre as cliente_nombre,
                c.apellido as cliente_apellido
            FROM reportes r
            JOIN clientes c ON r.cliente_id = c.id
            ORDER BY r.created_at DESC
        `);
        res.json(reportes);
    } catch (error) {
        console.error("Error al obtener la lista de reportes:", error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para actualizar el estado de un reporte
router.patch('/:id/estado', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado) {
        return res.status(400).json({ success: false, error: 'El estado es requerido.' });
    }

    try {
        await db.query('UPDATE reportes SET estado = ? WHERE id = ?', [estado, id]);
        res.json({ success: true, message: 'Estado del reporte actualizado correctamente.' });
    } catch (error) {
        console.error(`Error al actualizar el estado del reporte ${id}:`, error);
        res.status(500).json({ success: false, error: 'Error al actualizar el estado del reporte.' });
    }
});

module.exports = router;