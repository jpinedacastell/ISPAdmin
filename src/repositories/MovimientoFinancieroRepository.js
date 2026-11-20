// @ts-check

class MovimientoFinancieroRepository {
    /** @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} conexion */
    constructor(conexion) {
        this.conexion = conexion;
    }

    /**
     * @param {{ tipo: string, monto: any, descripcion: string, fecha: any, categoria: any, usuarioId: any, usuarioNombre: any }} movimiento
     */
    async registrar({ tipo, monto, descripcion, fecha, categoria, usuarioId, usuarioNombre }) {
        await this.conexion.query(
            `INSERT INTO movimientos_financieros 
                (tipo, monto, descripcion, fecha, categoria, usuario_id, usuario_nombre) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [tipo, monto, descripcion, fecha, categoria, usuarioId, usuarioNombre]
        );
    }
}

module.exports = { MovimientoFinancieroRepository };
