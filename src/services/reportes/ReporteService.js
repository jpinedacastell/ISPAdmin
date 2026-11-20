// @ts-check

class ReporteService {
    /** @param {{ reporteRepository: import('../../repositories/ReporteRepository').ReporteRepository }} deps */
    constructor({ reporteRepository }) {
        this.reportes = reporteRepository;
    }

    listar() {
        return this.reportes.listar();
    }

    cambiarEstado(id, estado) {
        return this.reportes.cambiarEstado(id, estado);
    }
}

module.exports = { ReporteService };
