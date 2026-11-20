// Punto único donde los repositorios se conectan con la base de datos.
// El resto de la aplicación recibe repositorios, nunca la conexión.
const db = require('../config/database');
const { conTransaccion } = require('../database/conTransaccion');
const { ClienteRepository } = require('./ClienteRepository');
const { PlanRepository } = require('./PlanRepository');
const { PagoRepository } = require('./PagoRepository');
const { MovimientoFinancieroRepository } = require('./MovimientoFinancieroRepository');
const { ContabilidadRepository } = require('./ContabilidadRepository');
const { ReporteRepository } = require('./ReporteRepository');
const { AdminRepository } = require('./AdminRepository');
const { DashboardRepository } = require('./DashboardRepository');
const { FacturaRepository } = require('./FacturaRepository');
const { TicketRepository } = require('./TicketRepository');
const { ServicioCatalogoRepository } = require('./ServicioCatalogoRepository');

const crearRepositorios = (conexion) => ({
    clientes: new ClienteRepository(conexion),
    planes: new PlanRepository(conexion),
    pagos: new PagoRepository(conexion),
    movimientos: new MovimientoFinancieroRepository(conexion),
    contabilidad: new ContabilidadRepository(conexion),
    reportes: new ReporteRepository(conexion),
    admins: new AdminRepository(conexion),
    dashboard: new DashboardRepository(conexion),
    facturas: new FacturaRepository(conexion),
    tickets: new TicketRepository(conexion),
    servicios: new ServicioCatalogoRepository(conexion)
});

/**
 * Ejecuta `trabajo` en una transacción. Recibe repositorios que usan esa
 * misma transacción; si `trabajo` lanza un error, se revierte todo.
 * @template T
 * @param {(repos: ReturnType<typeof crearRepositorios>) => Promise<T>} trabajo
 * @returns {Promise<T>}
 */
const enTransaccion = (trabajo) => conTransaccion(db, (conexion) => trabajo(crearRepositorios(conexion)));

module.exports = { ...crearRepositorios(db), enTransaccion };
