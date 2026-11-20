// @ts-check

const DIGITOS_CODIGO = 5;

/** @typedef {import('../../repositories/TicketRepository').TicketRepository} TicketRepository */
/** @typedef {import('../../repositories/ServicioCatalogoRepository').ServicioCatalogoRepository} ServicioCatalogoRepository */
/** @typedef {{ tickets: TicketRepository, servicios: ServicioCatalogoRepository }} ReposTickets */

class TicketService {
    /**
     * @param {object} deps
     * @param {TicketRepository} deps.ticketRepository
     * @param {ServicioCatalogoRepository} deps.servicioCatalogoRepository
     * @param {<T>(trabajo: (repos: ReposTickets) => Promise<T>) => Promise<T>} deps.enTransaccion
     */
    constructor({ ticketRepository, servicioCatalogoRepository, enTransaccion }) {
        this.tickets = ticketRepository;
        this.servicios = servicioCatalogoRepository;
        this.enTransaccion = enTransaccion;
    }

    clientesParaNuevoTicket() {
        return this.tickets.clientesConPlanActivo();
    }

    listar() {
        return this.tickets.listar();
    }

    serviciosDelCatalogo() {
        return this.servicios.listarActivos();
    }

    /** Ticket con comentarios, servicios, costos y totales; null si no existe */
    async detalle(id) {
        const ticket = await this.tickets.obtenerConCliente(id);
        if (!ticket) return null;

        const comentarios = await this.tickets.comentarios(id);
        const servicios = await this.tickets.servicios(id);
        const costos = await this.tickets.costos(id);

        const totalServicios = servicios.reduce((acc, s) => acc + (Number(s.cantidad) * Number(s.precio_unitario)), 0);
        const totalCostos = costos.reduce((acc, c) => acc + Number(c.monto), 0);

        return { ticket, comentarios, servicios, costos, totalServicios, totalCostos, totalTicket: totalServicios + totalCostos };
    }

    agregarComentario(datos) {
        return this.tickets.agregarComentario(datos);
    }

    async agregarCosto(ticketId, descripcion, monto) {
        const costoId = await this.tickets.agregarCosto(ticketId, descripcion, monto);
        return { costoId, totales: await totalesDe(this.tickets, ticketId) };
    }

    /** @returns {Promise<object | null>} totales del ticket, o null si el costo no existe */
    async eliminarCosto(costoId) {
        const ticketId = await this.tickets.ticketDeCosto(costoId);
        if (ticketId === undefined) return null;

        await this.tickets.eliminarCosto(costoId);
        return totalesDe(this.tickets, ticketId);
    }

    /** @returns {Promise<boolean>} false si el ticket no existe */
    async actualizarEstado(id, estado, prioridad) {
        return (await this.tickets.actualizarEstado(id, estado, prioridad)) > 0;
    }

    /**
     * Crea el ticket con su código (TCK-AAAAMM-00000) y los servicios iniciales
     * @returns {Promise<number>} id del ticket
     */
    crear({ cliente_id, asunto, descripcion, prioridad, servicios }, usuarioId) {
        return this.enTransaccion(async ({ tickets, servicios: catalogo }) => {
            const ticketId = await tickets.crear({ cliente_id, asunto, descripcion, prioridad, usuarioId });

            const creado = await tickets.fechaCreacion(ticketId);
            const createdAt = creado ? new Date(creado) : new Date();
            const yyyymm = `${createdAt.getUTCFullYear()}${String(createdAt.getUTCMonth() + 1).padStart(2, '0')}`;
            if (await tickets.soportaCodigoTicket()) {
                await tickets.asignarCodigo(ticketId, `TCK-${yyyymm}-${String(ticketId).padStart(DIGITOS_CODIGO, '0')}`);
            }

            let costoTotal = 0;
            if (servicios && servicios.length > 0) {
                for (const item of servicios) {
                    // Precio actual del catálogo para que el ticket quede consistente
                    const precioUnitario = await catalogo.precio(item.servicio_id);
                    await tickets.agregarServicio(ticketId, item.servicio_id, item.cantidad, precioUnitario);
                    costoTotal += item.cantidad * precioUnitario;
                }
            }

            if (costoTotal > 0) {
                await tickets.actualizarCostoTotal(ticketId, costoTotal);
            }

            return ticketId;
        });
    }

    /**
     * Agrega un servicio del catálogo; si no se elige uno, usa o crea uno por nombre
     * @param {{ servicio_id: any, cantidad: number, nombreNuevo: string, precioNuevo: number }} datos
     */
    agregarServicio(ticketId, { servicio_id, cantidad, nombreNuevo, precioNuevo }) {
        return this.enTransaccion(async ({ tickets, servicios: catalogo }) => {
            const { servicioId, precioUnitario } = await resolverServicio(catalogo, Number(servicio_id) || null, nombreNuevo, precioNuevo);

            const ticketServicioId = await tickets.agregarServicio(ticketId, servicioId, cantidad, precioUnitario);
            const nombre = (await catalogo.nombre(servicioId)) || 'Servicio';

            await tickets.recalcularCostoTotal(ticketId);

            return {
                servicio: {
                    id: ticketServicioId,
                    nombre,
                    cantidad,
                    precio_unitario: precioUnitario,
                    subtotal: cantidad * precioUnitario
                },
                totales: await totalesDe(tickets, ticketId)
            };
        });
    }

    /** @returns {Promise<object | null>} totales del ticket, o null si no existe */
    eliminarServicio(ticketServicioId) {
        return this.enTransaccion(async ({ tickets }) => {
            const item = await tickets.servicioDeTicket(ticketServicioId);
            if (!item) return null;

            await tickets.eliminarServicio(ticketServicioId);
            await tickets.recalcularCostoTotal(item.ticket_id);
            return totalesDe(tickets, item.ticket_id);
        });
    }

    /** @returns {Promise<{ cantidad: number, totales: object } | null>} null si no existe */
    actualizarPrecioServicio(ticketServicioId, precioUnitario) {
        return this.enTransaccion(async ({ tickets }) => {
            const item = await tickets.servicioDeTicket(ticketServicioId);
            if (!item) return null;

            await tickets.actualizarPrecioServicio(ticketServicioId, precioUnitario);
            await tickets.recalcularCostoTotal(item.ticket_id);
            return { cantidad: Number(item.cantidad || 0), totales: await totalesDe(tickets, item.ticket_id) };
        });
    }
}

/** @param {TicketRepository} tickets */
async function totalesDe(tickets, ticketId) {
    const { totalServicios, totalCostos } = await tickets.totales(ticketId);
    return { total_servicios: totalServicios, total_costos: totalCostos, total_ticket: totalServicios + totalCostos };
}

/**
 * Servicio a usar: el elegido del catálogo (debe estar activo), o uno por nombre (se reusa si existe)
 * @param {ServicioCatalogoRepository} catalogo
 */
async function resolverServicio(catalogo, servicioId, nombreNuevo, precioNuevo) {
    if (servicioId) {
        const precio = await catalogo.precioSiActivo(servicioId);
        if (precio === null) throw new Error('Servicio no encontrado o inactivo.');
        return { servicioId, precioUnitario: precio };
    }

    const nombre = (nombreNuevo || '').trim();
    if (!nombre) throw new Error('Seleccione un servicio o ingrese uno nuevo.');
    if (!precioNuevo || precioNuevo <= 0) throw new Error('Ingrese un precio válido para el nuevo servicio.');

    const existente = await catalogo.buscarPorNombre(nombre);
    if (existente) return { servicioId: existente.id, precioUnitario: Number(existente.precio) };

    return { servicioId: await catalogo.crear(nombre, precioNuevo), precioUnitario: precioNuevo };
}

module.exports = { TicketService };
