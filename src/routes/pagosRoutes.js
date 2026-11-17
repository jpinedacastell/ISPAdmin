// routes/pagosRoutes.js

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../config/database');

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
        const [pagos] = await db.query('SELECT * FROM pagos ORDER BY fecha_pago DESC');
        res.json(pagos);
    } catch (error) {
        console.error('Error al listar pagos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /pagos - Crear un nuevo pago
router.post('/', verifyToken, async (req, res) => {
    try {
        const { descripcion, monto, fecha_pago, categoria, referencia } = req.body;
        
        await db.query(
            `INSERT INTO movimientos_financieros 
                (tipo, monto, descripcion, fecha, categoria, usuario_id, usuario_nombre) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                'egreso',
                monto,
                `${descripcion} (Ref: ${referencia})`,
                fecha_pago,
                categoria,
                req.session.user.id,
                req.session.user.nombre
            ]
        );

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
        const { descripcion, monto, fecha_pago, categoria, metodo_pago, referencia } = req.body;
        const query = 'UPDATE pagos SET descripcion = ?, monto = ?, fecha_pago = ?, categoria = ?, metodo_pago = ?, referencia = ? WHERE id = ?';
        await db.query(query, [descripcion, monto, fecha_pago, categoria, metodo_pago, referencia, id]);
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
        const [rows] = await db.query('SELECT * FROM pagos WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// DELETE /pagos/:id - Eliminar un pago
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM pagos WHERE id = ?', [id]);
        res.json({ success: true, message: 'Pago eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar pago:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
