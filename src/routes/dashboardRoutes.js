// routes/dashboardRoutes.js

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const dashboardService = require('../services/dashboard');

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
        res.json(await dashboardService.estadisticas());
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ 
            error: 'Error al obtener estadísticas del dashboard' 
        });
    }
});

module.exports = router;
