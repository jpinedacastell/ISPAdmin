// @ts-check

const TIPO_EGRESO = 'egreso';

class PagoService {
    /**
     * @param {object} deps
     * @param {import('../../repositories/PagoRepository').PagoRepository} deps.pagoRepository
     * @param {import('../../repositories/MovimientoFinancieroRepository').MovimientoFinancieroRepository} deps.movimientoRepository
     */
    constructor({ pagoRepository, movimientoRepository }) {
        this.pagos = pagoRepository;
        this.movimientos = movimientoRepository;
    }

    listar() {
        return this.pagos.listar();
    }

    obtener(id) {
        return this.pagos.obtener(id);
    }

    /** Un gasto nuevo se guarda como egreso en contabilidad */
    registrarGasto({ descripcion, monto, fecha_pago, categoria, referencia }, usuario) {
        return this.movimientos.registrar({
            tipo: TIPO_EGRESO,
            monto,
            descripcion: `${descripcion} (Ref: ${referencia})`,
            fecha: fecha_pago,
            categoria,
            usuarioId: usuario.id,
            usuarioNombre: usuario.nombre
        });
    }

    actualizar(id, datos) {
        return this.pagos.actualizar(id, datos);
    }

    eliminar(id) {
        return this.pagos.eliminar(id);
    }
}

module.exports = { PagoService };
