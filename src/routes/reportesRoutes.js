const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const reporteService = require('../services/reportes');

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
        res.json(await reporteService.listar());
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
        await reporteService.cambiarEstado(id, estado);
        res.json({ success: true, message: 'Estado del reporte actualizado correctamente.' });
    } catch (error) {
        console.error(`Error al actualizar el estado del reporte ${id}:`, error);
        res.status(500).json({ success: false, error: 'Error al actualizar el estado del reporte.' });
    }
});

module.exports = router;