const repositorios = require('../../repositories');
const { PlanService } = require('./PlanService');

module.exports = new PlanService({
    planRepository: repositorios.planes,
    enTransaccion: repositorios.enTransaccion
});
