const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../config/database');

router.get('/perfil', verifyToken, async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const [rows] = await db.query(
            'SELECT id, usuario, nombre, email, created_at FROM administradores WHERE id = ?',
            [userId]
        );

        if (!rows.length) {
            req.flash('error_msg', 'Usuario no encontrado.');
            return res.redirect('/dashboard');
        }

        res.render('user/perfil', {
            title: 'Perfil',
            currentPage: '',
            perfil: rows[0],
            user: req.session.user
        });
    } catch (error) {
        console.error('Error al cargar perfil:', error);
        req.flash('error_msg', 'No se pudo cargar el perfil.');
        res.redirect('/dashboard');
    }
});

router.get('/configuracion', verifyToken, (req, res) => {
    res.render('user/configuracion', {
        title: 'Configuración',
        currentPage: '',
        user: req.session.user
    });
});

router.post('/configuracion/password', verifyToken, async (req, res) => {
    try {
        const { passwordActual, passwordNuevo, passwordConfirmacion } = req.body;
        const userId = req.session.user?.id;

        if (!passwordActual || !passwordNuevo || !passwordConfirmacion) {
            req.flash('error_msg', 'Todos los campos de contraseña son requeridos.');
            return res.redirect('/configuracion');
        }
        if (passwordNuevo.length < 6) {
            req.flash('error_msg', 'La nueva contraseña debe tener al menos 6 caracteres.');
            return res.redirect('/configuracion');
        }
        if (passwordNuevo !== passwordConfirmacion) {
            req.flash('error_msg', 'La confirmación de contraseña no coincide.');
            return res.redirect('/configuracion');
        }

        const [rows] = await db.query('SELECT password FROM administradores WHERE id = ?', [userId]);
        if (!rows.length) {
            req.flash('error_msg', 'Usuario no encontrado.');
            return res.redirect('/configuracion');
        }

        const passwordOk = await bcrypt.compare(passwordActual, rows[0].password);
        if (!passwordOk) {
            req.flash('error_msg', 'La contraseña actual es incorrecta.');
            return res.redirect('/configuracion');
        }

        const hashed = await bcrypt.hash(passwordNuevo, 10);
        await db.query('UPDATE administradores SET password = ? WHERE id = ?', [hashed, userId]);
        req.flash('success_msg', 'Contraseña actualizada correctamente.');
        res.redirect('/configuracion');
    } catch (error) {
        console.error('Error al actualizar contraseña:', error);
        req.flash('error_msg', 'No se pudo actualizar la contraseña.');
        res.redirect('/configuracion');
    }
});

module.exports = router;
