// @ts-check

class ServicioCatalogoRepository {
    /** @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} conexion */
    constructor(conexion) {
        this.conexion = conexion;
    }

    async listarActivos() {
        const [servicios] = await this.conexion.query('SELECT * FROM servicios_catalogo WHERE activo = 1 ORDER BY nombre');
        return servicios;
    }

    /** Precio actual (aunque el servicio esté inactivo) */
    async precio(id) {
        const [servicioInfo] = await this.conexion.query('SELECT precio FROM servicios_catalogo WHERE id = ?', [id]);
        return servicioInfo[0].precio;
    }

    /** @returns {Promise<number | null>} precio, o null si no existe o está inactivo */
    async precioSiActivo(id) {
        const [servicioInfo] = await this.conexion.query(
            'SELECT precio FROM servicios_catalogo WHERE id = ? AND activo = 1',
            [id]
        );
        return servicioInfo.length ? Number(servicioInfo[0].precio) : null;
    }

    /** Búsqueda sin distinguir mayúsculas */
    async buscarPorNombre(nombre) {
        const [existente] = await this.conexion.query(
            'SELECT id, precio FROM servicios_catalogo WHERE LOWER(nombre) = LOWER(?) LIMIT 1',
            [nombre]
        );
        return existente[0];
    }

    /** @returns {Promise<number>} id del servicio creado */
    async crear(nombre, precio) {
        const [insertServicio] = await this.conexion.query(
            'INSERT INTO servicios_catalogo (nombre, precio, activo) VALUES (?, ?, 1)',
            [nombre, precio]
        );
        return /** @type {any} */ (insertServicio).insertId;
    }

    async nombre(id) {
        const [servicioNombreRow] = await this.conexion.query(
            'SELECT nombre FROM servicios_catalogo WHERE id = ? LIMIT 1',
            [id]
        );
        return servicioNombreRow[0]?.nombre;
    }
}

module.exports = { ServicioCatalogoRepository };
