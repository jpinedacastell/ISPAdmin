// @ts-check

class ContabilidadService {
    /** @param {{ contabilidadRepository: import('../../repositories/ContabilidadRepository').ContabilidadRepository }} deps */
    constructor({ contabilidadRepository }) {
        this.contabilidad = contabilidadRepository;
    }

    movimientosDelMes(mes, anio) {
        return this.contabilidad.movimientosDelMes(mes, anio);
    }

    resumenDelMes(mes, anio) {
        return this.contabilidad.resumenDelMes(mes, anio);
    }
}

module.exports = { ContabilidadService };
