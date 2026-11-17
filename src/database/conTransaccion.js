// @ts-check

/**
 * Ejecuta `trabajo` dentro de una transacción y libera la conexión al terminar.
 * @template T
 * @param {import('mysql2/promise').Pool} pool
 * @param {(conexion: import('mysql2/promise').PoolConnection) => Promise<T>} trabajo
 * @returns {Promise<T>}
 */
async function conTransaccion(pool, trabajo) {
    const conexion = await pool.getConnection();
    try {
        await conexion.beginTransaction();
        const resultado = await trabajo(conexion);
        await conexion.commit();
        return resultado;
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

module.exports = { conTransaccion };
