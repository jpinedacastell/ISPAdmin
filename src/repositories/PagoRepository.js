// @ts-check

class PagoRepository {
    /** @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} conexion */
    constructor(conexion) {
        this.conexion = conexion;
    }

    async listar() {
        const [pagos] = await this.conexion.query('SELECT * FROM pagos ORDER BY fecha_pago DESC');
        return pagos;
    }

    /** @returns {Promise<any | undefined>} */
    async obtener(id) {
        const [rows] = await this.conexion.query('SELECT * FROM pagos WHERE id = ?', [id]);
        return rows[0];
    }

    async actualizar(id, { descripcion, monto, fecha_pago, categoria, metodo_pago, referencia }) {
        const query = 'UPDATE pagos SET descripcion = ?, monto = ?, fecha_pago = ?, categoria = ?, metodo_pago = ?, referencia = ? WHERE id = ?';
        await this.conexion.query(query, [descripcion, monto, fecha_pago, categoria, metodo_pago, referencia, id]);
    }

    async eliminar(id) {
        await this.conexion.query('DELETE FROM pagos WHERE id = ?', [id]);
    }
}

module.exports = { PagoRepository };
