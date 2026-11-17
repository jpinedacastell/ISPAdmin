// @ts-check

const { CONFIG_POR_DEFECTO } = require('../../domain/configuracion/configuracionSistema');

const TABLA_NO_EXISTE = 'ER_NO_SUCH_TABLE';

// La configuración se lee en cada página, así que se guarda en memoria
// y se vuelve a leer de la BD solo después de un cambio.
class ConfiguracionService {
    /** @param {{ configuracionRepository: import('../../repositories/ConfiguracionRepository').ConfiguracionRepository }} deps */
    constructor({ configuracionRepository }) {
        this.repo = configuracionRepository;
        /** @type {import('../../repositories/ConfiguracionRepository').ConfigSistema | null} */
        this.cache = null;
    }

    async obtener() {
        if (this.cache) return this.cache;

        try {
            this.cache = (await this.repo.obtenerSistema()) ?? CONFIG_POR_DEFECTO;
        } catch (error) {
            // Antes de correr la migración 007 se usan los valores de siempre
            if (/** @type {any} */ (error).code !== TABLA_NO_EXISTE) throw error;
            return CONFIG_POR_DEFECTO;
        }
        return this.cache;
    }

    /** @param {{ nombreSistema: string }} datos */
    async guardarGeneral(datos) {
        await this.repo.guardarGeneral(datos);
        this.cache = null;
    }

    /** @param {string} logoUrl */
    async guardarLogo(logoUrl) {
        await this.repo.guardarLogo(logoUrl);
        this.cache = null;
    }

    /** @param {import('../../repositories/ConfiguracionRepository').ConfigSistema['empresa']} empresa */
    async guardarEmpresa(empresa) {
        await this.repo.guardarEmpresa(empresa);
        this.cache = null;
    }

    obtenerFacturacion() {
        return this.repo.obtenerFacturacion();
    }

    /** @param {{ diaGeneracion: number, diasVencimiento: number, prefijoFactura: string }} datos */
    guardarFacturacion(datos) {
        return this.repo.guardarFacturacion(datos);
    }
}

module.exports = { ConfiguracionService };
