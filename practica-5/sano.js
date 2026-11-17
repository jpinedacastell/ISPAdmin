// @ts-check
// Misma lógica de clientes que enfermo.js, después del tratamiento.

const HTTP_STATUS = Object.freeze({
    OK: 200,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    CONFLICT: 409
});

const SIN_REGISTROS = 0;
const ID_MINIMO_VALIDO = 1;
const DNI_LONGITUD = 13;
const DNI_PATRON = new RegExp(`^\\d{${DNI_LONGITUD}}$`);
const EMAIL_PATRON = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- Id del cliente ----------

class ClienteIdInvalidoError extends Error {
    /** @param {unknown} valorRecibido */
    constructor(valorRecibido) {
        super(`El id de cliente "${valorRecibido}" no es válido`);
        this.name = 'ClienteIdInvalidoError';
    }
}

class ClienteId {
    #valor;

    /** @param {unknown} valorCrudo */
    constructor(valorCrudo) {
        const valor = Number(valorCrudo);
        if (valorCrudo === '' || !Number.isInteger(valor) || valor < ID_MINIMO_VALIDO) {
            throw new ClienteIdInvalidoError(valorCrudo);
        }
        this.#valor = valor;
    }

    get valor() {
        return this.#valor;
    }
}

// ---------- Dependencias del cliente ----------

class DependenciaCliente {
    /** @param {{ tabla: string, descripcion: string }} config */
    constructor({ tabla, descripcion }) {
        this.tabla = tabla;
        this.descripcion = descripcion;
    }

    /** @param {number} _cantidad @returns {boolean} */
    impideEliminar(_cantidad) {
        throw new Error(`${this.constructor.name} debe implementar impideEliminar()`);
    }
}

class DependenciaBloqueante extends DependenciaCliente {
    /** @param {number} cantidad */
    impideEliminar(cantidad) {
        return cantidad > SIN_REGISTROS;
    }
}

class DependenciaEnCascada extends DependenciaCliente {
    impideEliminar() {
        return false;
    }
}

const DEPENDENCIAS_CLIENTE = Object.freeze([
    new DependenciaBloqueante({ tabla: 'facturas', descripcion: 'facturas' }),
    new DependenciaBloqueante({ tabla: 'movimientos_financieros', descripcion: 'movimientos financieros' }),
    new DependenciaBloqueante({ tabla: 'contratos', descripcion: 'contratos' }),
    new DependenciaEnCascada({ tabla: 'cliente_plan', descripcion: 'historial de planes' }),
    new DependenciaEnCascada({ tabla: 'tickets', descripcion: 'tickets' }),
    new DependenciaEnCascada({ tabla: 'reportes', descripcion: 'reportes' })
]);

// ---------- Eliminar cliente ----------

/**
 * @typedef {object} RepositorioClientes
 * @property {(id: number) => Promise<boolean>} existe
 * @property {(tabla: string, id: number) => Promise<number>} contar
 * @property {(id: number) => Promise<void>} eliminar
 */

/** @param {{ dependencia: DependenciaCliente, cantidad: number }[]} conteos */
const listar = (conteos) => conteos.map(({ dependencia, cantidad }) => `${cantidad} ${dependencia.descripcion}`).join(', ');

/**
 * @param {RepositorioClientes} repo
 * @param {unknown} idCrudo
 */
async function eliminarCliente(repo, idCrudo, dependencias = DEPENDENCIAS_CLIENTE) {
    let id;
    try {
        id = new ClienteId(idCrudo).valor;
    } catch (error) {
        return { status: HTTP_STATUS.BAD_REQUEST, body: { success: false, error: /** @type {Error} */ (error).message } };
    }

    if (!(await repo.existe(id))) {
        return { status: HTTP_STATUS.NOT_FOUND, body: { success: false, error: 'Cliente no encontrado' } };
    }

    const conteos = await Promise.all(
        dependencias.map(async (dependencia) => ({ dependencia, cantidad: await repo.contar(dependencia.tabla, id) }))
    );

    const bloqueos = conteos.filter(({ dependencia, cantidad }) => dependencia.impideEliminar(cantidad));
    if (bloqueos.length > 0) {
        return {
            status: HTTP_STATUS.CONFLICT,
            body: { success: false, error: `No se puede eliminar: el cliente tiene ${listar(bloqueos)}. Desactívelo en su lugar.` }
        };
    }

    await repo.eliminar(id);

    const enCascada = conteos.filter(({ cantidad }) => cantidad > SIN_REGISTROS);
    const message = enCascada.length > 0 ? `Cliente eliminado junto con: ${listar(enCascada)}` : 'Cliente eliminado correctamente';
    return { status: HTTP_STATUS.OK, body: { success: true, message } };
}

// ---------- Estado del cliente ----------

const ESTADOS_CLIENTE = Object.freeze({
    activo: { etiqueta: 'Activo', claseBadge: 'bg-success' },
    inactivo: { etiqueta: 'Inactivo', claseBadge: 'bg-danger' },
    sin_plan: { etiqueta: 'Sin plan', claseBadge: 'bg-secondary' }
});

/**
 * MySQL devuelve activo como 0/1
 * @param {{ activo?: number | boolean | null }} cliente
 * @returns {keyof typeof ESTADOS_CLIENTE}
 */
function estadoCliente(cliente) {
    const sinPlan = cliente.activo === null || cliente.activo === undefined;
    if (sinPlan) return 'sin_plan';
    return cliente.activo ? 'activo' : 'inactivo';
}

/** @param {{ activo?: number | boolean | null }} cliente */
function badgeEstado(cliente) {
    const { etiqueta, claseBadge } = ESTADOS_CLIENTE[estadoCliente(cliente)];
    return `<span class="badge ${claseBadge}">${etiqueta}</span>`;
}

/**
 * @template {{ activo?: number | boolean | null }} T
 * @param {T[]} clientes
 * @param {string} [filtro] '' o undefined = todos
 */
const filtrarClientes = (clientes, filtro) => clientes.filter((cliente) => !filtro || estadoCliente(cliente) === filtro);

// ---------- Validación ----------

/** @param {unknown} valor */
const texto = (valor) => String(valor ?? '').trim();

const REGLAS_CLIENTE = Object.freeze([
    { esValido: (d) => d.nombre !== '' && d.apellido !== '', mensaje: 'Nombre y apellido son obligatorios' },
    { esValido: (d) => !d.dni || DNI_PATRON.test(d.dni), mensaje: `El DNI debe tener ${DNI_LONGITUD} dígitos numéricos` },
    { esValido: (d) => !d.email || EMAIL_PATRON.test(d.email), mensaje: 'El email no tiene un formato válido' }
]);

/** @param {Record<string, unknown>} datos @returns {string | null} */
function validarCliente(datos) {
    const normalizado = {
        nombre: texto(datos.nombre),
        apellido: texto(datos.apellido),
        dni: texto(datos.dni),
        email: texto(datos.email)
    };
    const reglaFallida = REGLAS_CLIENTE.find((regla) => !regla.esValido(normalizado));
    return reglaFallida ? reglaFallida.mensaje : null;
}

module.exports = {
    eliminarCliente,
    estadoCliente,
    badgeEstado,
    filtrarClientes,
    validarCliente,
    ClienteId,
    ClienteIdInvalidoError,
    DependenciaCliente,
    DependenciaBloqueante,
    DependenciaEnCascada,
    DEPENDENCIAS_CLIENTE,
    HTTP_STATUS
};
