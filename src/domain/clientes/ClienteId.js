// @ts-check

const ID_MINIMO_VALIDO = 1;

class ClienteIdInvalidoError extends Error {
    /** @param {unknown} valorRecibido */
    constructor(valorRecibido) {
        super(`El id de cliente "${String(valorRecibido)}" no es válido`);
        this.name = 'ClienteIdInvalidoError';
    }
}

// Id de cliente validado: siempre es un entero positivo
class ClienteId {
    /** @type {number} */
    #valor;

    /** @param {unknown} valorCrudo */
    constructor(valorCrudo) {
        const valor = Number(valorCrudo);
        if (!Number.isInteger(valor) || valor < ID_MINIMO_VALIDO) {
            throw new ClienteIdInvalidoError(valorCrudo);
        }
        this.#valor = valor;
    }

    /** @returns {number} */
    get valor() {
        return this.#valor;
    }
}

module.exports = { ClienteId, ClienteIdInvalidoError };
