// @ts-check

class PlanRepository {
    /** @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} conexion */
    constructor(conexion) {
        this.conexion = conexion;
    }

    async listarActivos() {
        const [planes] = await this.conexion.query('SELECT * FROM planes WHERE activo = true ORDER BY velocidad_descarga');
        return planes;
    }
}

module.exports = { PlanRepository };
