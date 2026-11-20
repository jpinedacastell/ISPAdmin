const repositorios = require('../../repositories');
const { TicketService } = require('./TicketService');

module.exports = new TicketService({
    ticketRepository: repositorios.tickets,
    servicioCatalogoRepository: repositorios.servicios,
    enTransaccion: repositorios.enTransaccion
});
