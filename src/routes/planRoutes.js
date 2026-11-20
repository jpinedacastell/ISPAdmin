const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const planService = require('../services/planes');

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
        res.json(await planService.listar());
    } catch (error) {
        console.error('Error al obtener planes:', error);
        res.status(500).json({ error: 'Error al obtener planes' });
    }
});

// Obtener un plan específico
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const plan = await planService.obtener(req.params.id);
        if (!plan) {
            return res.status(404).json({ error: 'Plan no encontrado' });
        }

        res.json(plan);
    } catch (error) {
        console.error('Error al obtener el plan:', error);
        res.status(500).json({ error: 'Error al obtener el plan' });
    }
});

// Actualizar un plan
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, velocidad_descarga, velocidad_subida, precio, descripcion } = req.body;

        // Validar datos
        if (!nombre || !velocidad_descarga || !velocidad_subida || !precio) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }

        const plan = await planService.actualizar(id, { nombre, velocidad_descarga, velocidad_subida, precio, descripcion });

        res.json({ 
            success: true, 
            message: 'Plan actualizado correctamente',
            plan
        });
    } catch (error) {
        console.error('Error al actualizar el plan:', error);
        res.status(500).json({ error: 'Error al actualizar el plan' });
    }
});

// Activar/desactivar plan
router.patch('/:id/toggle', verifyToken, async (req, res) => {
    try {
        const resultado = await planService.cambiarEstado(req.params.id);
        if (!resultado) {
            return res.status(404).json({ error: 'Plan no encontrado' });
        }

        res.json({ 
            success: true, 
            message: `Plan ${resultado.activo ? 'activado' : 'desactivado'} correctamente`,
            activo: resultado.activo
        });
    } catch (error) {
        console.error('Error al cambiar estado del plan:', error);
        res.status(500).json({ error: 'Error al cambiar estado del plan' });
    }
});

module.exports = router; 