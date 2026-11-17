// @ts-check

const { DEPENDENCIAS_CLIENTE } = require('../domain/clientes/dependenciasCliente');

const { CAMPOS_UNICOS } = require('../domain/clientes/datosCliente');

const TABLAS_PERMITIDAS = new Set(DEPENDENCIAS_CLIENTE.map(({ tabla }) => tabla));
const CAMPOS_BUSCABLES = new Set(CAMPOS_UNICOS.map(({ campo }) => campo));

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

    /**
     * @param {'dni' | 'email'} campo
     * @param {string} valor
     * @param {number | null} [excluirId] para no chocar con el mismo cliente al editar
     * @returns {Promise<boolean>}
     */
    async existeConCampo(campo, valor, excluirId = null) {
        if (!CAMPOS_BUSCABLES.has(campo)) {
            throw new Error(`Campo no permitido: ${campo}`);
        }
        const [filas] = await this.conexion.query(
            'SELECT 1 FROM clientes WHERE ?? = ? AND id <> ? LIMIT 1',
            [campo, valor, excluirId ?? 0]
        );
        return /** @type {any[]} */ (filas).length > 0;
    }

    /**
     * @param {import('../domain/clientes/datosCliente').DatosCliente} datos
     * @param {number | null} [excluirId]
     * @returns {Promise<string | null>} mensaje del primer duplicado, o null
     */
    async buscarDuplicado(datos, excluirId = null) {
        for (const { campo, mensaje } of CAMPOS_UNICOS) {
            const valor = datos[campo];
            if (valor && await this.existeConCampo(campo, valor, excluirId)) return mensaje;
        }
        return null;
    }

    /** @param {number} clienteId @returns {Promise<void>} */
    async eliminar(clienteId) {
        await this.conexion.query('DELETE FROM clientes WHERE id = ?', [clienteId]);
    }
}

module.exports = { ClienteRepository };
