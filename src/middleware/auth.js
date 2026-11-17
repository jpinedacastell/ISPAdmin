const jwt = require('jsonwebtoken');

// Middleware de autenticación
const verifyToken = (req, res, next) => {
    if (!req.session.user) {
        // Si es una petición AJAX, devolver 401
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({ error: 'No autorizado' });
        }
        // Si no hay usuario en la sesión, redirigir al login
        return res.redirect('/auth/login');
    }

    // Agregar el usuario a res.locals para que esté disponible en todas las vistas
    res.locals.user = req.session.user;
    res.locals.currentPage = req.path.split('/')[1] || 'dashboard';
    
    // Si hay usuario, continuar
    next();
};

// Middleware para verificar si el usuario ya está autenticado
const checkNotAuthenticated = (req, res, next) => {
    if (req.session.user) {
        // Si ya está autenticado, redirigir al dashboard
        return res.redirect('/dashboard');
    }
    // Si no está autenticado, continuar
    next();
};

module.exports = {
    verifyToken,
    checkNotAuthenticated
}; 