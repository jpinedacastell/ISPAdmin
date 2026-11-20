const repositorios = require('../../repositories');
const facturacionService = require('../facturacionService');
const { ClienteService } = require('./ClienteService');

module.exports = new ClienteService({
    clienteRepository: repositorios.clientes,
    planRepository: repositorios.planes,
    enTransaccion: repositorios.enTransaccion,
    asegurarEsquemaFacturas: () => facturacionService.ensureAbonosSchema()
});
