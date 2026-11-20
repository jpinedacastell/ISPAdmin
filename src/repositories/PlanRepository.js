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

    async listarTodos() {
        const [planes] = await this.conexion.query('SELECT * FROM planes ORDER BY velocidad_descarga');
        return planes;
    }

    /** @returns {Promise<any | undefined>} */
    async obtener(id) {
        const [planes] = await this.conexion.query('SELECT * FROM planes WHERE id = ?', [id]);
        return planes[0];
    }

    /** @param {{ nombre: string, velocidad_descarga: any, velocidad_subida: any, precio: any, descripcion: any }} datos */
    async actualizar(id, { nombre, velocidad_descarga, velocidad_subida, precio, descripcion }) {
        await this.conexion.query(
            `UPDATE planes 
             SET nombre = ?, 
                 velocidad_descarga = ?, 
                 velocidad_subida = ?, 
                 precio = ?, 
                 descripcion = ?
             WHERE id = ?`,
            [nombre, velocidad_descarga, velocidad_subida, precio, descripcion, id]
        );
    }

    /** @returns {Promise<{ activo: number } | undefined>} */
    async estado(id) {
        const [planes] = await this.conexion.query('SELECT activo FROM planes WHERE id = ?', [id]);
        return planes[0];
    }

    async cambiarActivo(id, activo) {
        await this.conexion.query('UPDATE planes SET activo = ? WHERE id = ?', [activo, id]);
    }
}

module.exports = { PlanRepository };
