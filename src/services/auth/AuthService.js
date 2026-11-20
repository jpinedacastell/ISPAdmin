// @ts-check

const bcrypt = require('bcrypt');

const COSTO_HASH = 10;

const RESULTADO_PASSWORD = Object.freeze({
    CORRECTA: 'CORRECTA',
    INCORRECTA: 'INCORRECTA',
    USUARIO_NO_ENCONTRADO: 'USUARIO_NO_ENCONTRADO'
});

class AuthService {
    /** @param {{ adminRepository: import('../../repositories/AdminRepository').AdminRepository }} deps */
    constructor({ adminRepository }) {
        this.admins = adminRepository;
    }

    /**
     * @returns {Promise<{ id: number, usuario: string, nombre: string, email: string } | null>}
     *   datos para la sesión, o null si el usuario o la contraseña no son válidos
     */
    async autenticar(usuario, password) {
        const admin = await this.admins.buscarPorUsuario(usuario);
        if (!admin) return null;

        const passwordValido = await bcrypt.compare(password, admin.password);
        if (!passwordValido) return null;

        return { id: admin.id, usuario: admin.usuario, nombre: admin.nombre, email: admin.email };
    }

    perfilBasico(id) {
        return this.admins.perfilBasico(id);
    }

    perfil(id) {
        return this.admins.perfil(id);
    }

    /** @returns {Promise<string>} uno de RESULTADO_PASSWORD */
    async verificarPassword(id, password) {
        const hash = await this.admins.hashDePassword(id);
        if (hash === undefined) return RESULTADO_PASSWORD.USUARIO_NO_ENCONTRADO;

        const correcta = await bcrypt.compare(password, hash);
        return correcta ? RESULTADO_PASSWORD.CORRECTA : RESULTADO_PASSWORD.INCORRECTA;
    }

    async cambiarPassword(id, passwordNuevo) {
        const hash = await bcrypt.hash(passwordNuevo, COSTO_HASH);
        await this.admins.actualizarPassword(id, hash);
    }

    async crearAdminInicial() {
        const hash = await bcrypt.hash('admin123', COSTO_HASH);
        await this.admins.crear({ usuario: 'admin', hash, nombre: 'Administrador' });
    }
}

module.exports = { AuthService, RESULTADO_PASSWORD };
