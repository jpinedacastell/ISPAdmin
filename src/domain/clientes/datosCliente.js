// @ts-check

const DNI_LONGITUD = 13;
const DNI_PATRON = new RegExp(`^\\d{${DNI_LONGITUD}}$`);
const EMAIL_PATRON = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @typedef {object} DatosCliente
 * @property {string | null} nombre
 * @property {string | null} apellido
 * @property {string | null} dni
 * @property {string | null} email
 * @property {string | null} telefono
 * @property {string | null} direccion
 * @property {string | null} plan_id
 */

/** @param {unknown} valor @returns {string | null} */
const textoOpcional = (valor) => {
    const texto = String(valor ?? '').trim();
    return texto === '' ? null : texto;
};

// Los vacíos se guardan como NULL: dni y email son UNIQUE y no admiten dos ''
/** @param {Record<string, unknown>} body @returns {DatosCliente} */
function normalizarDatosCliente(body) {
    const email = textoOpcional(body.email);
    return {
        nombre: textoOpcional(body.nombre),
        apellido: textoOpcional(body.apellido),
        dni: textoOpcional(body.dni),
        email: email && email.toLowerCase(),
        telefono: textoOpcional(body.telefono),
        direccion: textoOpcional(body.direccion),
        plan_id: textoOpcional(body.plan_id)
    };
}

/** @type {ReadonlyArray<{ esValido: (d: DatosCliente, opciones: { requierePlan: boolean }) => boolean, mensaje: string }>} */
const REGLAS = Object.freeze([
    { esValido: (d) => Boolean(d.nombre && d.apellido), mensaje: 'Nombre y apellido son obligatorios' },
    { esValido: (d, { requierePlan }) => !requierePlan || Boolean(d.plan_id), mensaje: 'Debe seleccionar un plan' },
    { esValido: (d) => !d.dni || DNI_PATRON.test(d.dni), mensaje: `El DNI debe tener ${DNI_LONGITUD} dígitos numéricos` },
    { esValido: (d) => !d.email || EMAIL_PATRON.test(d.email), mensaje: 'El email no tiene un formato válido' }
]);

/**
 * @param {DatosCliente} datos
 * @param {{ requierePlan: boolean }} opciones
 * @returns {string | null} primer error encontrado, o null si es válido
 */
function validarDatosCliente(datos, opciones) {
    const reglaFallida = REGLAS.find((regla) => !regla.esValido(datos, opciones));
    return reglaFallida ? reglaFallida.mensaje : null;
}

/** @type {ReadonlyArray<{ campo: 'dni' | 'email', mensaje: string }>} */
const CAMPOS_UNICOS = Object.freeze([
    { campo: 'dni', mensaje: 'Ya existe un cliente con este DNI' },
    { campo: 'email', mensaje: 'Ya existe un cliente con este email' }
]);

module.exports = { DNI_LONGITUD, normalizarDatosCliente, validarDatosCliente, CAMPOS_UNICOS };
