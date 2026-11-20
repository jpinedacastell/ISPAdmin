// Instancia compartida del servicio de facturación (rutas, clientes y script de generación)
const repositorios = require('../repositories');
const { FacturacionService } = require('./facturacion/FacturacionService');

module.exports = new FacturacionService({
    facturaRepository: repositorios.facturas,
    enTransaccion: repositorios.enTransaccion
});
