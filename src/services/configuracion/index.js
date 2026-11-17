// Instancia única compartida por el middleware y las rutas, para que
// un cambio en la configuración limpie la misma caché que leen las vistas.
const db = require('../../config/database');
const { ConfiguracionRepository } = require('../../repositories/ConfiguracionRepository');
const { ConfiguracionService } = require('./ConfiguracionService');

module.exports = new ConfiguracionService({
    configuracionRepository: new ConfiguracionRepository(db)
});
