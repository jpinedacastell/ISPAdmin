// @ts-check

const { EliminarClienteService } = require('./EliminarClienteService');

const RESULTADO_ESTADO = Object.freeze({
    CAMBIADO: 'CAMBIADO',
    NO_ENCONTRADO: 'NO_ENCONTRADO',
    SIN_PLAN: 'SIN_PLAN',
    NO_ACTUALIZADO: 'NO_ACTUALIZADO'
});

/** @typedef {import('../../repositories/ClienteRepository').ClienteRepository} ClienteRepository */
/** @typedef {import('../../domain/clientes/datosCliente').DatosCliente} DatosCliente */

class ClienteService {
    /**
     * @param {object} deps
     * @param {ClienteRepository} deps.clienteRepository
     * @param {{ listarActivos: () => Promise<any[]> }} deps.planRepository
     * @param {<T>(trabajo: (repos: { clientes: ClienteRepository }) => Promise<T>) => Promise<T>} deps.enTransaccion
     * @param {() => Promise<void>} deps.asegurarEsquemaFacturas
     */
    constructor({ clienteRepository, planRepository, enTransaccion, asegurarEsquemaFacturas }) {
        this.clientes = clienteRepository;
        this.planes = planRepository;
        this.enTransaccion = enTransaccion;
        this.asegurarEsquemaFacturas = asegurarEsquemaFacturas;
    }

    listar() {
        return this.clientes.listarConPlan();
    }

    planesActivos() {
        return this.planes.listarActivos();
    }

    /** @param {string | number} id */
    obtenerParaEdicion(id) {
        return this.clientes.obtenerConPlanVigente(id);
    }

    /**
     * Datos de la página de detalle, o null si el cliente no existe
     * @param {string | number} id
     */
    async obtenerDetalle(id) {
        const cliente = await this.clientes.obtenerConPlanActivo(id);
        if (!cliente) return null;

        await this.asegurarEsquemaFacturas();

        const facturas = await this.clientes.facturasDeCliente(id);
        const estadoPago = await this.clientes.estadoDePago(id);
        const tickets = await this.clientes.ticketsDeCliente(id);
        const notas = await this.clientes.notasDeCliente(id);

        return { cliente, facturas, estadoPago, tickets, notas };
    }

    /**
     * @param {DatosCliente} datos ya normalizados y validados
     * @returns {Promise<{ duplicado: string } | { clienteId: number }>}
     */
    crear(datos) {
        return this.enTransaccion(async ({ clientes }) => {
            const duplicado = await clientes.buscarDuplicado(datos);
            if (duplicado) return { duplicado };

            const clienteId = await clientes.insertar(datos);
            await clientes.asignarPlanInicial(clienteId, datos.plan_id);
            return { clienteId };
        });
    }

    /**
     * @param {string} id
     * @param {DatosCliente} datos ya normalizados y validados
     * @param {unknown} planId plan pedido; undefined = no tocar el plan
     * @returns {Promise<{ duplicado: string } | { cliente: any }>}
     */
    actualizar(id, datos, planId) {
        return this.enTransaccion(async ({ clientes }) => {
            const duplicado = await clientes.buscarDuplicado(datos, Number(id));
            if (duplicado) return { duplicado };

            await clientes.actualizar(id, datos);
            if (planId !== undefined) await cambiarPlanSiCorresponde(clientes, id, planId);

            return { cliente: await clientes.obtenerConPlanVigente(id) };
        });
    }

    /**
     * Activa o desactiva el plan vigente del cliente
     * @param {string} id
     * @returns {Promise<{ tipo: string, activo?: boolean }>}
     */
    cambiarEstado(id) {
        return this.enTransaccion(async ({ clientes }) => {
            if (!(await clientes.existe(/** @type {any} */ (id)))) return { tipo: RESULTADO_ESTADO.NO_ENCONTRADO };

            const plan = await clientes.planVigenteConEstado(id);
            if (!plan) return { tipo: RESULTADO_ESTADO.SIN_PLAN };

            const activo = !plan.activo;
            const filasAfectadas = await clientes.cambiarEstadoPlan(plan.id, id, activo);
            if (filasAfectadas === 0) return { tipo: RESULTADO_ESTADO.NO_ACTUALIZADO };

            return { tipo: RESULTADO_ESTADO.CAMBIADO, activo };
        });
    }

    /** @param {import('../../domain/clientes/ClienteId').ClienteId} clienteId */
    eliminar(clienteId) {
        return this.enTransaccion(({ clientes }) =>
            new EliminarClienteService({ clienteRepository: clientes }).ejecutar(clienteId)
        );
    }

    agregarNota(clienteId, nota) {
        return this.clientes.agregarNota(clienteId, nota);
    }

    eliminarNota(notaId, clienteId) {
        return this.clientes.eliminarNota(notaId, clienteId);
    }
}

// Solo cambia el plan si es distinto al vigente; el anterior se cierra con la fecha de hoy
async function cambiarPlanSiCorresponde(clientes, id, planId) {
    const actual = await clientes.planVigente(id);
    const cambio = (!actual && planId) || (actual && actual.plan_id !== parseInt(String(planId)));
    if (!cambio) return;

    if (actual) await clientes.cerrarPlanVigente(id);
    if (planId) await clientes.asignarPlanDesdeHoy(id, planId);
}

module.exports = { ClienteService, RESULTADO_ESTADO };
