const repositorios = require('../../repositories');
const { ReporteService } = require('./ReporteService');

module.exports = new ReporteService({ reporteRepository: repositorios.reportes });
