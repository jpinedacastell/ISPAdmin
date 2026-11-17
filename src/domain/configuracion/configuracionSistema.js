// @ts-check

// Valores que el sistema tenía fijos antes de poder configurarlos
const CONFIG_POR_DEFECTO = Object.freeze({
    nombreSistema: 'ISP Admin',
    logoUrl: '/img/Logo.png',
    empresa: Object.freeze({
        nombre: 'CONETXA',
        rtn: '',
        telefono: '(504) 8780-3554',
        direccion: 'Cofradia, Cortes, Honduras',
        email: 'info@conetxahn.com'
    })
});

const LIMITES = Object.freeze({
    NOMBRE_SISTEMA_MAX: 60,
    EMPRESA_NOMBRE_MAX: 100,
    RTN_MAX: 20,
    TELEFONO_MAX: 30,
    DIRECCION_MAX: 200,
    EMAIL_MAX: 100,
    DIA_GENERACION_MIN: 1,
    DIA_GENERACION_MAX: 28,
    DIAS_VENCIMIENTO_MIN: 1,
    DIAS_VENCIMIENTO_MAX: 90,
    PREFIJO_MAX: 10
});

// Tipos de imagen aceptados para el logo y su extensión
const FORMATOS_LOGO = Object.freeze({
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp'
});
const LOGO_TAMANO_MAX_BYTES = 2 * 1024 * 1024;

const EMAIL_PATRON = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** @param {unknown} valor */
const texto = (valor) => String(valor ?? '').trim();

/** @param {unknown} valor */
const entero = (valor) => Number.parseInt(String(valor ?? ''), 10);

/** @param {number} n @param {number} min @param {number} max */
const enRango = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

/**
 * @template T
 * @param {T} datos
 * @param {ReadonlyArray<{ esValido: (d: T) => boolean, mensaje: string }>} reglas
 * @returns {string | null}
 */
const primerError = (datos, reglas) => {
    const fallida = reglas.find((regla) => !regla.esValido(datos));
    return fallida ? fallida.mensaje : null;
};

/** @param {Record<string, unknown>} body */
function normalizarGeneral(body) {
    return { nombreSistema: texto(body.nombre_sistema) };
}

const REGLAS_GENERAL = Object.freeze([
    { esValido: (d) => d.nombreSistema !== '', mensaje: 'El nombre del sistema es obligatorio' },
    {
        esValido: (d) => d.nombreSistema.length <= LIMITES.NOMBRE_SISTEMA_MAX,
        mensaje: `El nombre del sistema admite máximo ${LIMITES.NOMBRE_SISTEMA_MAX} caracteres`
    }
]);

/** @param {ReturnType<typeof normalizarGeneral>} datos */
const validarGeneral = (datos) => primerError(datos, REGLAS_GENERAL);

/** @param {Record<string, unknown>} body */
function normalizarEmpresa(body) {
    return {
        nombre: texto(body.empresa_nombre),
        rtn: texto(body.empresa_rtn),
        telefono: texto(body.empresa_telefono),
        direccion: texto(body.empresa_direccion),
        email: texto(body.empresa_email).toLowerCase()
    };
}

const REGLAS_EMPRESA = Object.freeze([
    { esValido: (d) => d.nombre !== '', mensaje: 'El nombre de la empresa es obligatorio' },
    { esValido: (d) => d.nombre.length <= LIMITES.EMPRESA_NOMBRE_MAX, mensaje: 'El nombre de la empresa es demasiado largo' },
    { esValido: (d) => d.rtn.length <= LIMITES.RTN_MAX, mensaje: `El RTN admite máximo ${LIMITES.RTN_MAX} caracteres` },
    { esValido: (d) => d.telefono.length <= LIMITES.TELEFONO_MAX, mensaje: 'El teléfono es demasiado largo' },
    { esValido: (d) => d.direccion.length <= LIMITES.DIRECCION_MAX, mensaje: 'La dirección es demasiado larga' },
    { esValido: (d) => d.email.length <= LIMITES.EMAIL_MAX, mensaje: 'El email es demasiado largo' },
    { esValido: (d) => !d.email || EMAIL_PATRON.test(d.email), mensaje: 'El email de la empresa no es válido' }
]);

/** @param {ReturnType<typeof normalizarEmpresa>} datos */
const validarEmpresa = (datos) => primerError(datos, REGLAS_EMPRESA);

// El prefijo no se recorta: el espacio final de "Recibo - " es intencional
/** @param {Record<string, unknown>} body */
function normalizarFacturacion(body) {
    return {
        diaGeneracion: entero(body.dia_generacion),
        diasVencimiento: entero(body.dias_vencimiento),
        prefijoFactura: String(body.prefijo_factura ?? '')
    };
}

const REGLAS_FACTURACION = Object.freeze([
    {
        esValido: (d) => enRango(d.diaGeneracion, LIMITES.DIA_GENERACION_MIN, LIMITES.DIA_GENERACION_MAX),
        mensaje: `El día de generación debe estar entre ${LIMITES.DIA_GENERACION_MIN} y ${LIMITES.DIA_GENERACION_MAX}`
    },
    {
        esValido: (d) => enRango(d.diasVencimiento, LIMITES.DIAS_VENCIMIENTO_MIN, LIMITES.DIAS_VENCIMIENTO_MAX),
        mensaje: `Los días de vencimiento deben estar entre ${LIMITES.DIAS_VENCIMIENTO_MIN} y ${LIMITES.DIAS_VENCIMIENTO_MAX}`
    },
    { esValido: (d) => d.prefijoFactura.trim() !== '', mensaje: 'El prefijo de factura es obligatorio' },
    {
        esValido: (d) => d.prefijoFactura.length <= LIMITES.PREFIJO_MAX,
        mensaje: `El prefijo admite máximo ${LIMITES.PREFIJO_MAX} caracteres`
    }
]);

/** @param {ReturnType<typeof normalizarFacturacion>} datos */
const validarFacturacion = (datos) => primerError(datos, REGLAS_FACTURACION);

module.exports = {
    CONFIG_POR_DEFECTO,
    LIMITES,
    FORMATOS_LOGO,
    LOGO_TAMANO_MAX_BYTES,
    normalizarGeneral,
    validarGeneral,
    normalizarEmpresa,
    validarEmpresa,
    normalizarFacturacion,
    validarFacturacion
};
