const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const contabilidadService = require('../services/contabilidad');

// GET /contabilidad - Muestra la vista principal (sin cambios)
router.get('/', verifyToken, (req, res) => {
    res.render('contabilidad/index', {
        title: 'Contabilidad',
        currentPage: 'contabilidad',
        user: req.session.user
    });
});

// API para la tabla, AHORA CON FILTROS
router.get('/list', verifyToken, async (req, res) => {
    try {
        const mes = Number(req.query.mes) || (new Date().getMonth() + 1);
        const anio = Number(req.query.anio) || new Date().getFullYear();

        res.json(await contabilidadService.movimientosDelMes(mes, anio));
    } catch (error) {
        console.error('Error al obtener movimientos contables:', error);
        res.status(500).json({ error: 'Error al obtener movimientos contables.' });
    }
});

// NUEVA API para el resumen del mes
router.get('/summary', verifyToken, async (req, res) => {
    try {
        const mes = Number(req.query.mes) || (new Date().getMonth() + 1);
        const anio = Number(req.query.anio) || new Date().getFullYear();

        res.json(await contabilidadService.resumenDelMes(mes, anio));
    } catch (error) {
        console.error('Error al obtener resumen contable:', error);
        res.status(500).json({ error: 'Error al obtener resumen contable.' });
    }
});

module.exports = router;
