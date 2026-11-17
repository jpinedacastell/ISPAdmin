const configuracionService = require('../services/configuracion');
const { CONFIG_POR_DEFECTO } = require('../domain/configuracion/configuracionSistema');

// Deja la configuración disponible en todas las vistas como `sistema`
async function cargarConfiguracionSistema(req, res, next) {
    try {
        res.locals.sistema = await configuracionService.obtener();
    } catch (error) {
        console.error('Error al cargar la configuración del sistema:', error);
        res.locals.sistema = CONFIG_POR_DEFECTO;
    }
    next();
}

module.exports = { cargarConfiguracionSistema };
