const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { verifyToken, checkNotAuthenticated } = require('../middleware/auth');
const authController = require('../controllers/authController');
const authService = require('../services/auth');
const { RESULTADO_PASSWORD } = require('../services/auth/AuthService');

// Validaciones
const validarLogin = [
  body('usuario').notEmpty().withMessage('El usuario es requerido'),
  body('password').notEmpty().withMessage('La contraseña es requerida')
];

const validarCambioPassword = [
  body('passwordActual').notEmpty().withMessage('La contraseña actual es requerida'),
  body('passwordNuevo')
    .isLength({ min: 6 })
    .withMessage('La nueva contraseña debe tener al menos 6 caracteres')
];

// Ruta de login (GET) - CORREGIDA
router.get('/login', checkNotAuthenticated, authController.mostrarLogin); // <--- ERROR AQUÍ

// Ruta para procesar el login
router.post('/login', validarLogin, async (req, res) => {
    try {
        const { usuario, password } = req.body;

        const admin = await authService.autenticar(usuario, password);
        if (!admin) {
            return res.status(401).json({
                success: false,
                error: 'Usuario o contraseña incorrectos'
            });
        }

        // Guardar usuario en sesión
        req.session.user = admin;

        // Asegurarse de que la sesión se guarde antes de responder
        req.session.save((err) => {
            if (err) {
                console.error('Error al guardar la sesión:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Error al iniciar sesión'
                });
            }

            // Enviar respuesta exitosa
            res.json({
                success: true,
                redirect: '/dashboard'
            });
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            error: 'Error al procesar el login'
        });
    }
});

// Ruta para obtener perfil
router.get('/perfil', verifyToken, async (req, res) => {
    try {
        const perfil = await authService.perfilBasico(req.user.id);
        if (!perfil) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(perfil);
    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({ error: 'Error al obtener perfil' });
    }
});

// Ruta para cambiar contraseña
router.post('/cambiar-password', verifyToken, validarCambioPassword, async (req, res) => {
    try {
        const { passwordActual, passwordNuevo } = req.body;
        
        const resultado = await authService.verificarPassword(req.user.id, passwordActual);
        if (resultado === RESULTADO_PASSWORD.USUARIO_NO_ENCONTRADO) {
            throw new Error('Usuario no encontrado');
        }
        if (resultado === RESULTADO_PASSWORD.INCORRECTA) {
            return res.status(401).json({ error: 'Contraseña actual incorrecta' });
        }

        await authService.cambiarPassword(req.user.id, passwordNuevo);

        res.json({ message: 'Contraseña actualizada exitosamente' });
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        res.status(500).json({ error: 'Error al cambiar contraseña' });
    }
});

// Ruta de logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
            return res.status(500).json({
                success: false,
                error: 'Error al cerrar sesión'
            });
        }
        res.redirect('/auth/login');
    });
});

// Ruta temporal para crear admin (eliminar en producción)
router.get('/setup', async (req, res) => {
    try {
        await authService.crearAdminInicial();
        
        res.send('Administrador creado exitosamente');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error al crear administrador');
    }
});

module.exports = router;