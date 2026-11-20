const repositorios = require('../../repositories');
const { PagoService } = require('./PagoService');

module.exports = new PagoService({
    pagoRepository: repositorios.pagos,
    movimientoRepository: repositorios.movimientos
});
