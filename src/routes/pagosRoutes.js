// routes/pagosRoutes.js

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const pagoService = require('../services/pagos');

// GET /pagos - Muestra la vista principal
router.get('/', verifyToken, (req, res) => {
    res.render('pagos', { // Asume que el archivo EJS se llama 'pagos.ejs'
        title: 'Gestión de Pagos',
        currentPage: 'pagos',
        user: req.session.user
    });
});

// GET /pagos/list - API para listar todos los pagos para DataTables
router.get('/list', verifyToken, async (req, res) => {
    try {
        res.json(await pagoService.listar());
    } catch (error) {
        console.error('Error al listar pagos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /pagos - Crear un nuevo pago
router.post('/', verifyToken, async (req, res) => {
    try {
        await pagoService.registrarGasto(req.body, req.session.user);

        res.status(201).json({ success: true, message: 'Gasto registrado correctamente' });
    } catch (error) {
        console.error('Error al crear pago:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /pagos/:id - Actualizar un pago existente
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pagoService.actualizar(id, req.body);
        res.json({ success: true, message: 'Pago actualizado correctamente' });
    } catch (error) {
        console.error('Error al actualizar pago:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /pagos/:id - Obtener un pago por ID
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pago = await pagoService.obtener(id);
        if (!pago) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }
        res.json(pago);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// DELETE /pagos/:id - Eliminar un pago
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pagoService.eliminar(id);
        res.json({ success: true, message: 'Pago eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar pago:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
