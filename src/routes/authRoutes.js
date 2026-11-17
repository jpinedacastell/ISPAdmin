const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { verifyToken, checkNotAuthenticated } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const authController = require('../controllers/authController'); // Esta línea importa el archivo que acabas de crear.

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

        // Buscar usuario en la base de datos
        const [usuarios] = await db.query('SELECT * FROM administradores WHERE usuario = ?', [usuario]);

        if (usuarios.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Usuario o contraseña incorrectos'
            });
        }

        const user = usuarios[0];

        // Verificar contraseña con bcrypt
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                error: 'Usuario o contraseña incorrectos'
            });
        }

        // Guardar usuario en sesión
        req.session.user = {
            id: user.id,
            usuario: user.usuario,
            nombre: user.nombre,
            email: user.email
        };

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
        const [user] = await db.query('SELECT id, usuario, nombre FROM administradores WHERE id = ?', [req.user.id]);
        if (user.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(user[0]);
    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({ error: 'Error al obtener perfil' });
    }
});

// Ruta para cambiar contraseña
router.post('/cambiar-password', verifyToken, validarCambioPassword, async (req, res) => {
    try {
        const { passwordActual, passwordNuevo } = req.body;
        
        // Verificar contraseña actual
        const [user] = await db.query('SELECT password FROM administradores WHERE id = ?', [req.user.id]);
        const validPassword = await bcrypt.compare(passwordActual, user[0].password);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Contraseña actual incorrecta' });
        }

        // Encriptar nueva contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(passwordNuevo, salt);

        // Actualizar contraseña
        await db.query('UPDATE administradores SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

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
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);
        
        await db.query(`
            INSERT INTO administradores (usuario, password, nombre) 
            VALUES (?, ?, ?)
        `, ['admin', hashedPassword, 'Administrador']);
        
        res.send('Administrador creado exitosamente');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error al crear administrador');
    }
});

module.exports = router;