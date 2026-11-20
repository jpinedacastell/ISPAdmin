// @ts-check

class ReporteRepository {
    /** @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} conexion */
    constructor(conexion) {
        this.conexion = conexion;
    }

    async listar() {
        const [reportes] = await this.conexion.query(`
                SELECT 
                    r.id,
                    r.tipo_reporte,
                    r.descripcion,
                    r.estado,
                    r.created_at,
                    c.nombre as cliente_nombre,
                    c.apellido as cliente_apellido
                FROM reportes r
                JOIN clientes c ON r.cliente_id = c.id
                ORDER BY r.created_at DESC
            `);
        return reportes;
    }

    async cambiarEstado(id, estado) {
        await this.conexion.query('UPDATE reportes SET estado = ? WHERE id = ?', [estado, id]);
    }
}

module.exports = { ReporteRepository };
