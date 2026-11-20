// @ts-check

const db = require('../config/database');

const CONFIG_ID = 1;

/**
 * @typedef {object} ConfigSistema
 * @property {string} nombreSistema
 * @property {string} logoUrl
 * @property {{ nombre: string, rtn: string, telefono: string, direccion: string, email: string }} empresa
 */

class ConfiguracionRepository {
    /** @param {import('mysql2/promise').Pool} pool */
    constructor(pool) {
        this.pool = pool;
    }

    /** @returns {Promise<ConfigSistema | null>} */
    async obtenerSistema() {
        const [filas] = await this.pool.query('SELECT * FROM config_sistema WHERE id = ?', [CONFIG_ID]);
        const fila = /** @type {any[]} */ (filas)[0];
        if (!fila) return null;

        return {
            nombreSistema: fila.nombre_sistema,
            logoUrl: fila.logo_url,
            empresa: {
                nombre: fila.empresa_nombre ?? '',
                rtn: fila.empresa_rtn ?? '',
                telefono: fila.empresa_telefono ?? '',
                direccion: fila.empresa_direccion ?? '',
                email: fila.empresa_email ?? ''
            }
        };
    }

    /** @param {{ nombreSistema: string }} datos */
    async guardarGeneral({ nombreSistema }) {
        await this.pool.query('UPDATE config_sistema SET nombre_sistema = ? WHERE id = ?', [nombreSistema, CONFIG_ID]);
    }

    /** @param {string} logoUrl */
    async guardarLogo(logoUrl) {
        await this.pool.query('UPDATE config_sistema SET logo_url = ? WHERE id = ?', [logoUrl, CONFIG_ID]);
    }

    /** @param {ConfigSistema['empresa']} empresa */
    async guardarEmpresa(empresa) {
        await this.pool.query(
            `UPDATE config_sistema
             SET empresa_nombre = ?, empresa_rtn = ?, empresa_telefono = ?, empresa_direccion = ?, empresa_email = ?
             WHERE id = ?`,
            [empresa.nombre, empresa.rtn, empresa.telefono, empresa.direccion, empresa.email, CONFIG_ID]
        );
    }

    async obtenerFacturacion() {
        const [filas] = await this.pool.query(
            'SELECT id, dia_generacion, dias_vencimiento, prefijo_factura, ultimo_numero FROM config_facturacion ORDER BY id LIMIT 1'
        );
        return /** @type {any[]} */ (filas)[0] ?? null;
    }

    /** @param {{ diaGeneracion: number, diasVencimiento: number, prefijoFactura: string }} datos */
    async guardarFacturacion({ diaGeneracion, diasVencimiento, prefijoFactura }) {
        const actual = await this.obtenerFacturacion();
        if (!actual) throw new Error('No existe la configuración de facturación');

        await this.pool.query(
            'UPDATE config_facturacion SET dia_generacion = ?, dias_vencimiento = ?, prefijo_factura = ? WHERE id = ?',
            [diaGeneracion, diasVencimiento, prefijoFactura, actual.id]
        );
    }
}

module.exports = {
    ConfiguracionRepository,
    configuracionRepository: new ConfiguracionRepository(db)
};
