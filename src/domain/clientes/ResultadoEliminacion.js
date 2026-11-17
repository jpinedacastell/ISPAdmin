// @ts-check

const TIPO_RESULTADO = Object.freeze({
    ELIMINADO: 'ELIMINADO',
    NO_ENCONTRADO: 'NO_ENCONTRADO',
    BLOQUEADO: 'BLOQUEADO'
});

/** @typedef {{ descripcion: string, cantidad: number }} Conteo */

class ResultadoEliminacion {
    /**
     * @param {keyof typeof TIPO_RESULTADO} tipo
     * @param {Conteo[]} detalle
     */
    constructor(tipo, detalle = []) {
        this.tipo = tipo;
        this.detalle = Object.freeze([...detalle]);
        Object.freeze(this);
    }

    /** @param {Conteo[]} eliminadosEnCascada */
    static eliminado(eliminadosEnCascada) {
        return new ResultadoEliminacion(TIPO_RESULTADO.ELIMINADO, eliminadosEnCascada);
    }

    static noEncontrado() {
        return new ResultadoEliminacion(TIPO_RESULTADO.NO_ENCONTRADO);
    }

    /** @param {Conteo[]} bloqueos */
    static bloqueado(bloqueos) {
        return new ResultadoEliminacion(TIPO_RESULTADO.BLOQUEADO, bloqueos);
    }
}

module.exports = { ResultadoEliminacion, TIPO_RESULTADO };
