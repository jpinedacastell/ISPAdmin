// @ts-check

const { DEPENDENCIAS_CLIENTE } = require('../domain/clientes/dependenciasCliente');

const TABLAS_PERMITIDAS = new Set(DEPENDENCIAS_CLIENTE.map(({ tabla }) => tabla));

class ClienteRepository {
    /** @param {import('mysql2/promise').PoolConnection} conexion */
    constructor(conexion) {
        this.conexion = conexion;
    }

    /** @param {number} clienteId @returns {Promise<boolean>} */
    async existe(clienteId) {
        const [filas] = await this.conexion.query(
            'SELECT 1 FROM clientes WHERE id = ? LIMIT 1',
            [clienteId]
        );
        return /** @type {any[]} */ (filas).length > 0;
    }

    /**
     * @param {string} tabla
     * @param {number} clienteId
     * @returns {Promise<number>}
     */
    async contarRelacionados(tabla, clienteId) {
        // El nombre de la tabla va directo al SQL, solo se aceptan las conocidas
        if (!TABLAS_PERMITIDAS.has(tabla)) {
            throw new Error(`Tabla no permitida: ${tabla}`);
        }
        const [filas] = await this.conexion.query(
            'SELECT COUNT(*) AS total FROM ?? WHERE cliente_id = ?',
            [tabla, clienteId]
        );
        return Number(/** @type {any[]} */ (filas)[0].total);
    }

    /** @param {number} clienteId @returns {Promise<void>} */
    async eliminar(clienteId) {
        await this.conexion.query('DELETE FROM clientes WHERE id = ?', [clienteId]);
    }
}

module.exports = { ClienteRepository };
