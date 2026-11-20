// @ts-check

class AdminRepository {
    /** @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} conexion */
    constructor(conexion) {
        this.conexion = conexion;
    }

    /** Incluye el hash de la contraseña: solo para autenticar */
    async buscarPorUsuario(usuario) {
        const [usuarios] = await this.conexion.query('SELECT * FROM administradores WHERE usuario = ?', [usuario]);
        return usuarios[0];
    }

    async perfilBasico(id) {
        const [usuarios] = await this.conexion.query('SELECT id, usuario, nombre FROM administradores WHERE id = ?', [id]);
        return usuarios[0];
    }

    async perfil(id) {
        const [rows] = await this.conexion.query(
            'SELECT id, usuario, nombre, email, created_at FROM administradores WHERE id = ?',
            [id]
        );
        return rows[0];
    }

    /** @returns {Promise<string | undefined>} */
    async hashDePassword(id) {
        const [rows] = await this.conexion.query('SELECT password FROM administradores WHERE id = ?', [id]);
        return rows[0]?.password;
    }

    async actualizarPassword(id, hash) {
        await this.conexion.query('UPDATE administradores SET password = ? WHERE id = ?', [hash, id]);
    }

    async crear({ usuario, hash, nombre }) {
        await this.conexion.query(`
            INSERT INTO administradores (usuario, password, nombre) 
            VALUES (?, ?, ?)
        `, [usuario, hash, nombre]);
    }
}

module.exports = { AdminRepository };
