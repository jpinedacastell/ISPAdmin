// @ts-check

const SIN_REGISTROS = 0;

class DependenciaCliente {
    /**
     * @param {object} config
     * @param {string} config.tabla
     * @param {string} config.descripcion
     */
    constructor({ tabla, descripcion }) {
        this.tabla = tabla;
        this.descripcion = descripcion;
    }

    /**
     * @param {number} _cantidad
     * @returns {boolean}
     */
    impideEliminar(_cantidad) {
        throw new Error(`${this.constructor.name} debe implementar impideEliminar()`);
    }
}

// Historial contable o legal que no se debe perder
class DependenciaBloqueante extends DependenciaCliente {
    /** @param {number} cantidad */
    impideEliminar(cantidad) {
        return cantidad > SIN_REGISTROS;
    }
}

// La BD los borra en cascada junto con el cliente
class DependenciaEnCascada extends DependenciaCliente {
    impideEliminar() {
        return false;
    }
}

// Debe coincidir con las FK hacia clientes (RESTRICT = bloqueante, CASCADE = en cascada)
/** @type {ReadonlyArray<DependenciaCliente>} */
const DEPENDENCIAS_CLIENTE = Object.freeze([
    new DependenciaBloqueante({ tabla: 'facturas', descripcion: 'facturas' }),
    new DependenciaBloqueante({ tabla: 'movimientos_financieros', descripcion: 'movimientos financieros' }),
    new DependenciaBloqueante({ tabla: 'contratos', descripcion: 'contratos' }),
    new DependenciaEnCascada({ tabla: 'cliente_plan', descripcion: 'historial de planes' }),
    new DependenciaEnCascada({ tabla: 'tickets', descripcion: 'tickets' }),
    new DependenciaEnCascada({ tabla: 'reportes', descripcion: 'reportes' })
]);

module.exports = {
    DependenciaCliente,
    DependenciaBloqueante,
    DependenciaEnCascada,
    DEPENDENCIAS_CLIENTE
};
