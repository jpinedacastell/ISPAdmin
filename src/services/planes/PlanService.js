// @ts-check

/** @typedef {import('../../repositories/PlanRepository').PlanRepository} PlanRepository */

class PlanService {
    /**
     * @param {object} deps
     * @param {PlanRepository} deps.planRepository
     * @param {<T>(trabajo: (repos: { planes: PlanRepository }) => Promise<T>) => Promise<T>} deps.enTransaccion
     */
    constructor({ planRepository, enTransaccion }) {
        this.planes = planRepository;
        this.enTransaccion = enTransaccion;
    }

    listar() {
        return this.planes.listarTodos();
    }

    obtener(id) {
        return this.planes.obtener(id);
    }

    /** Actualiza el plan y devuelve cómo quedó */
    actualizar(id, datos) {
        return this.enTransaccion(async ({ planes }) => {
            await planes.actualizar(id, datos);
            return planes.obtener(id);
        });
    }

    /**
     * Invierte el estado activo del plan
     * @returns {Promise<{ activo: boolean } | null>} null si el plan no existe
     */
    async cambiarEstado(id) {
        const plan = await this.planes.estado(id);
        if (!plan) return null;

        const activo = !plan.activo;
        await this.planes.cambiarActivo(id, activo);
        return { activo };
    }
}

module.exports = { PlanService };
