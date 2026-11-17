const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const MySQLStoreFactory = require('express-mysql-session');
const csrf = require('csurf');
const flash = require('connect-flash');

// Cargar variables de entorno
dotenv.config();

// Verificar variables de entorno
console.log('Variables de entorno cargadas:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  DB_NAME: process.env.DB_NAME
});

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const planRoutes = require('./routes/planRoutes');
const facturacionRoutes = require('./routes/facturacionRoutes');
const pagosRoutes = require('./routes/pagosRoutes');
const reportesRoutes = require('./routes/reportesRoutes');
const ticketsRoutes = require('./routes/ticketsRoutes');
const contabilidadRoutes = require('./routes/contabilidadRoutes');
const userRoutes = require('./routes/userRoutes');

const { verifyToken } = require('./middleware/auth');

// Crear aplicación Express
const app = express();

// Configurar EJS como motor de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware básico
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(logger('dev'));

// Configuración de archivos estáticos
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/img', express.static(path.join(__dirname, '../public/img')));
app.use(express.static('public'));

// Configuración de sesión
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'c_isp',
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 24 * 60 * 60 * 1000,
    createDatabaseTable: true,
    schema: {
        tableName: 'sessions',
        columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data'
        }
    }
});

app.use(session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'tu_secreto_aqui',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Configuración de mensajes flash
app.use(flash());

// Protección CSRF
app.use(csrf({ cookie: true }));

// Variables globales
app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.session.user || null;
    res.locals.currentPage = '';
    res.locals.title = 'ISP Admin';
    next();
});

// Rutas
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/clientes', clienteRoutes);
app.use('/planes', planRoutes);
app.use('/facturacion', facturacionRoutes);
app.use('/pagos', pagosRoutes);
app.use('/reportes', reportesRoutes);
app.use('/tickets', ticketsRoutes);
app.use('/contabilidad', contabilidadRoutes);
app.use('/', userRoutes);

// Ruta raíz
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/auth/login');
    }
});

// Manejo de errores CSRF
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        // Si es una petición AJAX/API, devolver un error JSON
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(403).json({
                error: 'Token CSRF inválido'
            });
        }
        
        // Para peticiones normales, redirigir al dashboard con un mensaje de error
        req.flash('error', 'La sesión ha expirado. Por favor, intente nuevamente.');
        return res.redirect('/auth/login');
    }
    next(err);
});

// Puerto
const PORT = process.env.PORT || 3000;

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

// Manejador de error 404
app.use((req, res) => {
    res.status(404).render('error/404');
});

module.exports = app;
