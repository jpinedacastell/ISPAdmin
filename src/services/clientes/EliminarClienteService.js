// @ts-check

const { DEPENDENCIAS_CLIENTE } = require('../../domain/clientes/dependenciasCliente');
const { ResultadoEliminacion } = require('../../domain/clientes/ResultadoEliminacion');

const SIN_REGISTROS = 0;

/**
 * @typedef {object} RepositorioEliminacionCliente
 * @property {(clienteId: number) => Promise<boolean>} existe
 * @property {(tabla: string, clienteId: number) => Promise<number>} contarRelacionados
 * @property {(clienteId: number) => Promise<void>} eliminar
 */

class EliminarClienteService {
    /**
     * @param {object} deps
     * @param {RepositorioEliminacionCliente} deps.clienteRepository
     * @param {ReadonlyArray<import('../../domain/clientes/dependenciasCliente').DependenciaCliente>} [deps.dependencias]
     */
    constructor({ clienteRepository, dependencias = DEPENDENCIAS_CLIENTE }) {
        this.clienteRepository = clienteRepository;
        this.dependencias = dependencias;
    }

    /**
     * @param {import('../../domain/clientes/ClienteId').ClienteId} clienteId
     * @returns {Promise<ResultadoEliminacion>}
     */
    async ejecutar(clienteId) {
        const id = clienteId.valor;

        const existe = await this.clienteRepository.existe(id);
        if (!existe) return ResultadoEliminacion.noEncontrado();

        const conteos = await this.#contarDependencias(id);

        const bloqueos = conteos.filter(({ dependencia, cantidad }) => dependencia.impideEliminar(cantidad));
        if (bloqueos.length > 0) return ResultadoEliminacion.bloqueado(bloqueos.map(aConteoLegible));

        await this.clienteRepository.eliminar(id);

        const eliminadosEnCascada = conteos.filter(({ cantidad }) => cantidad > SIN_REGISTROS);
        return ResultadoEliminacion.eliminado(eliminadosEnCascada.map(aConteoLegible));
    }

    /** @param {number} id */
    #contarDependencias(id) {
        return Promise.all(
            this.dependencias.map(async (dependencia) => ({
                dependencia,
                cantidad: await this.clienteRepository.contarRelacionados(dependencia.tabla, id)
            }))
        );
    }
}

/** @param {{ dependencia: { descripcion: string }, cantidad: number }} conteo */
const aConteoLegible = ({ dependencia, cantidad }) => ({ descripcion: dependencia.descripcion, cantidad });

module.exports = { EliminarClienteService };
