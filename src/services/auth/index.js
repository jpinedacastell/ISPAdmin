const repositorios = require('../../repositories');
const { AuthService } = require('./AuthService');

module.exports = new AuthService({ adminRepository: repositorios.admins });
