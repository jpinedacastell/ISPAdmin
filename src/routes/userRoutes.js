const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const authService = require('../services/auth');
const { RESULTADO_PASSWORD } = require('../services/auth/AuthService');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const configuracionService = require('../services/configuracion');
const {
    LIMITES,
    FORMATOS_LOGO,
    LOGO_TAMANO_MAX_BYTES,
    normalizarGeneral,
    validarGeneral,
    normalizarEmpresa,
    validarEmpresa,
    normalizarFacturacion,
    validarFacturacion
} = require('../domain/configuracion/configuracionSistema');

router.get('/perfil', verifyToken, async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const perfil = await authService.perfil(userId);

        if (!perfil) {
            req.flash('error_msg', 'Usuario no encontrado.');
            return res.redirect('/dashboard');
        }

        res.render('user/perfil', {
            title: 'Perfil',
            currentPage: '',
            perfil,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error al cargar perfil:', error);
        req.flash('error_msg', 'No se pudo cargar el perfil.');
        res.redirect('/dashboard');
    }
});

const PESTANAS_CONFIGURACION = ['general', 'empresa', 'facturacion', 'seguridad'];

router.get('/configuracion', verifyToken, async (req, res) => {
    try {
        const pestana = PESTANAS_CONFIGURACION.includes(req.query.tab) ? req.query.tab : 'general';

        res.render('user/configuracion', {
            title: 'Configuración',
            currentPage: '',
            user: req.session.user,
            pestana,
            facturacion: await configuracionService.obtenerFacturacion(),
            limites: LIMITES,
            formatosLogo: Object.values(FORMATOS_LOGO).join(', '),
            logoTamanoMaxMb: LOGO_TAMANO_MAX_BYTES / (1024 * 1024)
        });
    } catch (error) {
        console.error('Error al cargar configuración:', error);
        req.flash('error_msg', 'No se pudo cargar la configuración.');
        res.redirect('/dashboard');
    }
});

/**
 * Valida, guarda y redirige a la pestaña correspondiente.
 * Las tres secciones de texto siguen el mismo flujo, solo cambian estas piezas.
 */
const SECCIONES_CONFIGURACION = {
    general: { normalizar: normalizarGeneral, validar: validarGeneral, guardar: (d) => configuracionService.guardarGeneral(d) },
    empresa: { normalizar: normalizarEmpresa, validar: validarEmpresa, guardar: (d) => configuracionService.guardarEmpresa(d) },
    facturacion: { normalizar: normalizarFacturacion, validar: validarFacturacion, guardar: (d) => configuracionService.guardarFacturacion(d) }
};

Object.entries(SECCIONES_CONFIGURACION).forEach(([seccion, { normalizar, validar, guardar }]) => {
    router.post(`/configuracion/${seccion}`, verifyToken, async (req, res) => {
        const volver = `/configuracion?tab=${seccion}`;
        try {
            const datos = normalizar(req.body);
            const error = validar(datos);
            if (error) {
                req.flash('error_msg', error);
                return res.redirect(volver);
            }

            await guardar(datos);
            req.flash('success_msg', 'Configuración guardada correctamente.');
            res.redirect(volver);
        } catch (error) {
            console.error(`Error al guardar configuración (${seccion}):`, error);
            req.flash('error_msg', 'No se pudo guardar la configuración.');
            res.redirect(volver);
        }
    });
});

// Logo
const CARPETA_LOGOS = path.join(__dirname, '../../public/img/uploads');
const URL_LOGOS = '/img/uploads/';
fs.mkdirSync(CARPETA_LOGOS, { recursive: true });

const subirLogo = multer({
    storage: multer.diskStorage({
        destination: CARPETA_LOGOS,
        filename: (req, file, cb) => cb(null, `logo-${Date.now()}${FORMATOS_LOGO[file.mimetype]}`)
    }),
    limits: { fileSize: LOGO_TAMANO_MAX_BYTES, files: 1 },
    fileFilter: (req, file, cb) => cb(null, Boolean(FORMATOS_LOGO[file.mimetype]))
}).single('logo');

const MENSAJES_ERROR_MULTER = {
    LIMIT_FILE_SIZE: `El logo no puede pesar más de ${LOGO_TAMANO_MAX_BYTES / (1024 * 1024)} MB.`
};

function borrarLogoAnterior(logoUrl) {
    if (!logoUrl || !logoUrl.startsWith(URL_LOGOS)) return;
    const archivo = path.join(CARPETA_LOGOS, path.basename(logoUrl));
    fs.promises.unlink(archivo).catch(() => {});
}

// El token CSRF va en la URL del formulario: csurf se ejecuta antes que multer
router.post('/configuracion/logo', verifyToken, (req, res) => {
    const volver = '/configuracion?tab=general';

    subirLogo(req, res, async (errorSubida) => {
        if (errorSubida) {
            req.flash('error_msg', MENSAJES_ERROR_MULTER[errorSubida.code] || 'No se pudo subir el logo.');
            return res.redirect(volver);
        }
        if (!req.file) {
            req.flash('error_msg', `Seleccione una imagen válida (${Object.values(FORMATOS_LOGO).join(', ')}).`);
            return res.redirect(volver);
        }

        try {
            const { logoUrl: logoAnterior } = await configuracionService.obtener();
            await configuracionService.guardarLogo(URL_LOGOS + req.file.filename);
            borrarLogoAnterior(logoAnterior);

            req.flash('success_msg', 'Logo actualizado correctamente.');
        } catch (error) {
            console.error('Error al guardar el logo:', error);
            fs.promises.unlink(req.file.path).catch(() => {});
            req.flash('error_msg', 'No se pudo guardar el logo.');
        }
        res.redirect(volver);
    });
});

router.post('/configuracion/password', verifyToken, async (req, res) => {
    try {
        const { passwordActual, passwordNuevo, passwordConfirmacion } = req.body;
        const userId = req.session.user?.id;

        if (!passwordActual || !passwordNuevo || !passwordConfirmacion) {
            req.flash('error_msg', 'Todos los campos de contraseña son requeridos.');
            return res.redirect('/configuracion?tab=seguridad');
        }
        if (passwordNuevo.length < 6) {
            req.flash('error_msg', 'La nueva contraseña debe tener al menos 6 caracteres.');
            return res.redirect('/configuracion?tab=seguridad');
        }
        if (passwordNuevo !== passwordConfirmacion) {
            req.flash('error_msg', 'La confirmación de contraseña no coincide.');
            return res.redirect('/configuracion?tab=seguridad');
        }

        const resultado = await authService.verificarPassword(userId, passwordActual);
        if (resultado === RESULTADO_PASSWORD.USUARIO_NO_ENCONTRADO) {
            req.flash('error_msg', 'Usuario no encontrado.');
            return res.redirect('/configuracion?tab=seguridad');
        }
        if (resultado === RESULTADO_PASSWORD.INCORRECTA) {
            req.flash('error_msg', 'La contraseña actual es incorrecta.');
            return res.redirect('/configuracion?tab=seguridad');
        }

        await authService.cambiarPassword(userId, passwordNuevo);
        req.flash('success_msg', 'Contraseña actualizada correctamente.');
        res.redirect('/configuracion?tab=seguridad');
    } catch (error) {
        console.error('Error al actualizar contraseña:', error);
        req.flash('error_msg', 'No se pudo actualizar la contraseña.');
        res.redirect('/configuracion?tab=seguridad');
    }
});

module.exports = router;
