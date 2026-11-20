const repositorios = require('../../repositories');
const { DashboardService } = require('./DashboardService');

module.exports = new DashboardService({ dashboardRepository: repositorios.dashboard });
