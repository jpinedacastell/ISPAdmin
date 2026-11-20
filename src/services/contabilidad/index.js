const repositorios = require('../../repositories');
const { ContabilidadService } = require('./ContabilidadService');

module.exports = new ContabilidadService({ contabilidadRepository: repositorios.contabilidad });
