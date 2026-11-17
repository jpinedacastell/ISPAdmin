const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { validationResult } = require('express-validator');

const authController = {
  // --- FUNCIÓN CORREGIDA ---
  // Ahora está DENTRO del objeto que se exporta.
  mostrarLogin(req, res) {
    try {
        res.render('auth/login', {
            title: 'Iniciar Sesión',
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error("Error al renderizar la vista de login:", error);
        res.status(500).send("Error al cargar la página de login.");
    }
  },

  // Login de administrador
  async login(req, res) {
    // Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { usuario, password } = req.body;

      // Autenticar usuario
      const admin = await Admin.autenticar(usuario, password);
      if (!admin) {
        return res.status(401).json({
          error: 'Credenciales inválidas'
        });
      }

      // Generar JWT
      const token = jwt.sign(
        { id: admin.id, usuario: admin.usuario },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.json({
        token,
        admin: {
          id: admin.id,
          usuario: admin.usuario,
          nombre: admin.nombre,
          email: admin.email
        }
      });
    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({ error: 'Error en el servidor' });
    }
  },

  // Obtener información del administrador actual
  async obtenerPerfil(req, res) {
    try {
      const admin = await Admin.obtenerPorId(req.user.id);
      if (!admin) {
        return res.status(404).json({ error: 'Administrador no encontrado' });
      }
      res.json(admin);
    } catch (error) {
      console.error('Error al obtener perfil:', error);
      res.status(500).json({ error: 'Error en el servidor' });
    }
  },

  // Cambiar contraseña
  async cambiarPassword(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { passwordActual, passwordNuevo } = req.body;
      const actualizado = await Admin.cambiarPassword(req.user.id, passwordActual, passwordNuevo);

      if (!actualizado) {
        return res.status(400).json({ error: 'Contraseña actual incorrecta' });
      }

      res.json({ mensaje: 'Contraseña actualizada correctamente' });
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      res.status(500).json({ error: 'Error en el servidor' });
    }
  }
};

// Exporta el objeto completo
module.exports = authController;