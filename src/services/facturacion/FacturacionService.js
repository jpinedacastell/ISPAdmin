// Lógica de facturación: descuentos, generación mensual, pagos y abonos a favor.
// No conoce la base de datos: recibe los repositorios y una función para abrir transacciones.

const MESES_DEL_ANIO = 12;
const DIGITOS_NUMERO_FACTURA = 8;

/** @typedef {import('../../repositories/FacturaRepository').FacturaRepository} FacturaRepository */

class FacturacionService {
    /**
     * @param {object} deps
     * @param {FacturaRepository} deps.facturaRepository
     * @param {<T>(trabajo: (repos: { facturas: FacturaRepository, movimientos: any }) => Promise<T>) => Promise<T>} deps.enTransaccion
     */
    constructor({ facturaRepository, enTransaccion }) {
        this.facturas = facturaRepository;
        this.enTransaccion = enTransaccion;
        this.abonosSchemaReady = false;
    }

    async ensureAbonosSchema() {
        if (this.abonosSchemaReady) {
            return;
        }

        await this.facturas.asegurarColumnasDeAbonos();
        this.abonosSchemaReady = true;
    }

    toMoney(value) {
        return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
    }

    calcularTotalFactura(factura) {
        return this.toMoney(Number(factura.monto || 0) - Number(factura.descuento_monto || 0));
    }

    calcularSaldoFactura(factura) {
        const totalFactura = this.calcularTotalFactura(factura);
        const montoPagado = Number(factura.monto_pagado || 0);
        const creditoAplicado = Number(factura.credito_aplicado || 0);

        return this.toMoney(Math.max(totalFactura - montoPagado - creditoAplicado, 0));
    }

    /** @param {FacturaRepository} [facturas] repositorio de la transacción en curso */
    async obtenerSaldoFavorCliente(clienteId, facturas = this.facturas) {
        await this.ensureAbonosSchema();
        return this.toMoney((await facturas.saldoFavorDeCliente(clienteId)) || 0);
    }

    /**
     * Usa el saldo a favor del cliente para pagar sus facturas pendientes, de la más antigua a la más nueva
     * @param {FacturaRepository} facturas repositorio de la transacción en curso
     */
    async aplicarSaldoFavorAPendientes(clienteId, facturas, facturaOrigenId = null) {
        await this.ensureAbonosSchema();

        let saldoFavor = await this.obtenerSaldoFavorCliente(clienteId, facturas);
        const facturasAbonadas = [];

        if (saldoFavor <= 0) {
            return facturasAbonadas;
        }

        const facturasPendientes = await facturas.pendientesParaAbonar(clienteId, facturaOrigenId);

        for (const factura of facturasPendientes) {
            if (saldoFavor <= 0) {
                break;
            }

            const saldoFactura = this.calcularSaldoFactura(factura);

            if (saldoFactura <= 0) {
                continue;
            }

            const montoAplicado = this.toMoney(Math.min(saldoFavor, saldoFactura));
            const nuevoCreditoAplicado = this.toMoney(Number(factura.credito_aplicado || 0) + montoAplicado);
            const nuevoSaldoFactura = this.toMoney(saldoFactura - montoAplicado);
            const quedaPagada = nuevoSaldoFactura <= 0;

            await facturas.aplicarCredito(factura.id, {
                creditoAplicado: nuevoCreditoAplicado,
                estado: quedaPagada ? 'pagada' : factura.estado,
                quedaPagada
            });

            facturasAbonadas.push({
                factura_id: factura.id,
                numero_factura: factura.numero_factura,
                monto_aplicado: montoAplicado,
                saldo_pendiente: nuevoSaldoFactura,
                pagada: quedaPagada
            });

            saldoFavor = this.toMoney(saldoFavor - montoAplicado);
        }

        return facturasAbonadas;
    }

    async aplicarDescuento(idFactura, porcentaje, motivo) {
        await this.ensureAbonosSchema();

        return this.enTransaccion(async ({ facturas }) => {
            const facturaData = await facturas.obtener(idFactura);
            if (!facturaData) {
                throw new Error('Factura no encontrada');
            }

            if (facturaData.descuento_porcentaje > 0) {
                throw new Error('Ya existe un descuento aplicado a esta factura');
            }

            const descuento = (facturaData.monto * porcentaje) / 100;

            const filasAfectadas = await facturas.aplicarDescuento(idFactura, { porcentaje, monto: descuento, motivo });
            if (filasAfectadas !== 1) {
                throw new Error('No se pudo actualizar la factura');
            }

            return {
                success: true,
                data: {
                    id: idFactura,
                    monto_anterior: facturaData.monto,
                    monto_descuento: descuento,
                    porcentaje_descuento: porcentaje,
                    motivo_descuento: motivo
                }
            };
        });
    }

    /**
     * Extiende la fecha de vencimiento y guarda el historial de prórrogas
     * @returns {Promise<object | null>} la factura actualizada, o null si no existe
     */
    async aplicarProrroga(idFactura, dias, motivo) {
        const factura = await this.facturas.obtenerConClienteYPlan(idFactura);
        if (!factura) return null;

        const nuevaFechaVencimiento = new Date(factura.fecha_vencimiento);
        nuevaFechaVencimiento.setDate(nuevaFechaVencimiento.getDate() + dias);

        await this.facturas.actualizarCampos(idFactura, {
            fecha_vencimiento: nuevaFechaVencimiento,
            prorroga: [...(factura.prorroga || []), { dias, motivo, fecha: new Date() }]
        });

        return {
            ...factura,
            fecha_vencimiento: nuevaFechaVencimiento,
            prorroga: [...(factura.prorroga || []), { dias, motivo, fecha: new Date() }]
        };
    }

    async generarFacturasMensuales(forzarGeneracion = false, fechaEspecifica = null) {
        try {
            await this.ensureAbonosSchema();
            return await this.enTransaccion(({ facturas }) =>
                this.#generarEnTransaccion(facturas, forzarGeneracion, fechaEspecifica)
            );
        } catch (error) {
            console.error('Error en la generación de facturas:', error);
            throw error;
        }
    }

    /** @param {FacturaRepository} facturas */
    async #generarEnTransaccion(facturas, forzarGeneracion, fechaEspecifica) {
        const configuracion = await facturas.configuracionDeNumeracion();
        if (!configuracion) throw new Error('Configuración de facturación no encontrada');

        let fechaBase;
        if (fechaEspecifica) {
            // Formato YYYY-MM; siempre se factura el día 1 del mes
            const [year, month] = fechaEspecifica.split('-').map(Number);

            if (isNaN(year) || isNaN(month) || month < 1 || month > MESES_DEL_ANIO) {
                throw new Error('Formato de fecha inválido. Use YYYY-MM con mes entre 01-12');
            }

            fechaBase = new Date(Date.UTC(year, month - 1, 1));

            if (fechaBase.getUTCMonth() + 1 !== month) {
                throw new Error('Error en conversión de fecha. Mes no coincide');
            }

            fechaBase = new Date(Date.UTC(fechaBase.getUTCFullYear(), fechaBase.getUTCMonth(), 1));
        } else {
            // Generación automática: solo el día 1, para el mes actual
            const now = new Date();
            if (now.getUTCDate() !== 1) {
                return {
                    success: false,
                    message: 'La generación automática de facturas solo está permitida el día 1 de cada mes'
                };
            }
            fechaBase = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        }

        if (!forzarGeneracion && !fechaEspecifica) {
            const now = new Date();
            if (now.getUTCDate() !== 1) {
                return {
                    success: false,
                    message: 'Las facturas solo se pueden generar automáticamente el día 1 de cada mes'
                };
            }
        }

        const mes = fechaBase.toISOString().slice(0, 7);

        if ((await facturas.contarDelMes(mes)) > 0 && !forzarGeneracion) {
            return {
                success: false,
                message: 'Ya existen facturas generadas para el mes seleccionado'
            };
        }

        const clientes = await facturas.clientesPorFacturar(mes);

        if (clientes.length === 0) {
            return {
                success: true,
                message: 'No hay clientes pendientes de facturar este mes'
            };
        }

        let facturasGeneradas = 0;
        const errores = [];

        for (const cliente of clientes) {
            try {
                const ultimoNumero = await facturas.siguienteNumero(configuracion.id);
                const numeroFactura = `${configuracion.prefijo_factura}${String(ultimoNumero).padStart(DIGITOS_NUMERO_FACTURA, '0')}`;

                const fechaEmision = new Date();
                const fechaVencimiento = new Date(fechaEmision);
                fechaVencimiento.setDate(fechaVencimiento.getDate() + configuracion.dias_vencimiento);

                const mesFacturado = `${fechaBase.getUTCFullYear()}-${String(fechaBase.getUTCMonth() + 1).padStart(2, '0')}-01`;

                const saldoFavor = await this.obtenerSaldoFavorCliente(cliente.cliente_id, facturas);
                const creditoAplicado = this.toMoney(Math.min(saldoFavor, Number(cliente.precio || 0)));
                const estadoFactura = creditoAplicado >= Number(cliente.precio || 0) ? 'pagada' : 'pendiente';

                await facturas.insertar({
                    cliente_id: cliente.cliente_id,
                    plan_id: cliente.plan_id,
                    numero_factura: numeroFactura,
                    fecha_emision: fechaEmision,
                    fecha_vencimiento: fechaVencimiento,
                    mes_facturado: mesFacturado,
                    monto: cliente.precio,
                    estado: estadoFactura,
                    credito_aplicado: creditoAplicado,
                    fecha_pago: estadoFactura === 'pagada' ? new Date() : null,
                    metodo_pago: estadoFactura === 'pagada' ? 'Abono a favor' : null
                });

                facturasGeneradas++;
            } catch (error) {
                errores.push(`Error al generar factura para ${cliente.nombre} ${cliente.apellido}: ${error.message}`);
            }
        }

        // Si no se pudo generar ninguna, se revierte todo
        if (errores.length > 0 && facturasGeneradas === 0) {
            throw new Error(`No se pudo generar ninguna factura: ${errores.join(', ')}`);
        }

        return {
            success: true,
            message: `Se generaron ${facturasGeneradas} facturas correctamente${errores.length > 0 ? `. Hubo ${errores.length} errores: ${errores.join(', ')}` : ''}`,
            facturasGeneradas,
            errores
        };
    }

    async obtenerFacturasCliente(clienteId) {
        try {
            await this.ensureAbonosSchema();
            return await this.facturas.listarDeCliente(clienteId);
        } catch (error) {
            console.error('Error al obtener facturas del cliente:', error);
            throw error;
        }
    }

    async actualizarEstadoFactura(facturaId, estado, metodoPago = null) {
        try {
            await this.ensureAbonosSchema();
            return await this.enTransaccion(async ({ facturas }) => {
                const fechaPago = estado === 'pagada' ? new Date() : null;

                if (estado === 'pagada') {
                    const factura = await facturas.obtenerParaActualizar(facturaId);
                    if (!factura) {
                        throw new Error('Factura no encontrada');
                    }

                    const saldoFactura = this.calcularSaldoFactura(factura);
                    const nuevoMontoPagado = this.toMoney(Number(factura.monto_pagado || 0) + saldoFactura);

                    await facturas.marcarPagada(facturaId, { estado, fechaPago, metodoPago, montoPagado: nuevoMontoPagado });
                } else {
                    await facturas.cambiarEstado(facturaId, { estado, fechaPago, metodoPago });
                }

                return {
                    success: true,
                    message: 'Estado de factura actualizado correctamente'
                };
            });
        } catch (error) {
            console.error('Error al actualizar estado de factura:', error);
            throw error;
        }
    }

    async obtenerFacturas() {
        try {
            await this.ensureAbonosSchema();
            return await this.facturas.listar();
        } catch (error) {
            console.error('Error al obtener facturas:', error);
            throw error;
        }
    }

    async obtenerFactura(id) {
        try {
            await this.ensureAbonosSchema();
            const factura = await this.facturas.obtenerDetalle(id);
            if (!factura) return null;

            // Asegurar que el mes facturado quede como YYYY-MM-01
            const [year, month] = factura.mes_facturado.split('-');
            factura.mes_facturado = `${year}-${month}-01`;

            try {
                factura.descuentos = factura.descuentos ? JSON.parse(factura.descuentos) : [];
            } catch (error) {
                console.error('Error al parsear descuentos:', error);
                factura.descuentos = [];
            }

            return factura;
        } catch (error) {
            console.error('Error al obtener factura:', error);
            throw error;
        }
    }

    async registrarPagoFactura(idFactura, usuario, pago = {}) {
        try {
            await this.ensureAbonosSchema();
            return await this.enTransaccion(async ({ facturas, movimientos }) => {
                const factura = await facturas.obtenerParaActualizar(idFactura);
                if (!factura) {
                    throw new Error('Factura no encontrada');
                }

                const saldoAntes = this.calcularSaldoFactura(factura);
                const montoRecibido = this.toMoney(pago.monto_recibido ?? pago.monto ?? saldoAntes);
                const metodoPago = pago.metodo_pago || factura.metodo_pago || 'Efectivo';

                if (!Number.isFinite(montoRecibido) || montoRecibido <= 0) {
                    throw new Error('El monto recibido debe ser mayor a cero');
                }

                const montoAplicado = this.toMoney(Math.min(montoRecibido, saldoAntes));
                const abonoGenerado = this.toMoney(Math.max(montoRecibido - saldoAntes, 0));
                const saldoPendiente = this.toMoney(Math.max(saldoAntes - montoAplicado, 0));
                const quedaPagada = saldoPendiente <= 0;

                await facturas.registrarPago(idFactura, {
                    montoPagado: this.toMoney(Number(factura.monto_pagado || 0) + montoAplicado),
                    pagoRecibido: this.toMoney(Number(factura.pago_recibido || 0) + montoRecibido),
                    abonoSiguiente: this.toMoney(Number(factura.abono_siguiente || 0) + abonoGenerado),
                    estado: quedaPagada ? 'pagada' : factura.estado,
                    quedaPagada,
                    metodoPago
                });

                const descripcionAbono = abonoGenerado > 0
                    ? ` con L ${abonoGenerado.toFixed(2)} de abono a favor`
                    : '';

                await movimientos.registrarPagoDeFactura({
                    monto: montoRecibido,
                    descripcion: `Pago de factura #${idFactura}${descripcionAbono}`,
                    clienteId: factura.cliente_id,
                    facturaId: idFactura,
                    usuarioId: usuario.id,
                    usuarioNombre: usuario.nombre
                });

                const facturasAbonadas = abonoGenerado > 0
                    ? await this.aplicarSaldoFavorAPendientes(factura.cliente_id, facturas, idFactura)
                    : [];

                return {
                    success: true,
                    message: abonoGenerado > 0
                        ? `Pago registrado. Se generó un abono de L ${abonoGenerado.toFixed(2)}.`
                        : 'Pago registrado y factura actualizada correctamente',
                    data: {
                        factura_id: Number(idFactura),
                        total_factura: this.calcularTotalFactura(factura),
                        saldo_anterior: saldoAntes,
                        monto_recibido: montoRecibido,
                        monto_aplicado: montoAplicado,
                        abono_generado: abonoGenerado,
                        saldo_pendiente: saldoPendiente,
                        estado: quedaPagada ? 'pagada' : factura.estado,
                        facturas_abonadas: facturasAbonadas
                    }
                };
            });
        } catch (error) {
            console.error('Error al registrar pago de factura:', error);
            throw error;
        }
    }

    /**
     * Estado de cada mes del año por cliente (pagada / pendiente / sin_factura / no_aplica) y su deuda
     * @param {number} anio
     * @param {string} estadoCliente 'activos' | 'desactivados' | cualquier otro = todos
     * @param {boolean} soloConDeuda
     */
    async resumenAnual(anio, estadoCliente, soloConDeuda) {
        await this.ensureAbonosSchema();

        const rows = await this.facturas.resumenAnualPorMes(anio, estadoCliente);
        const deudas = await this.facturas.deudasDelAnio(anio, estadoCliente);

        const deudasMap = new Map(deudas.map((deuda) => [deuda.cliente_id, Number(deuda.total_por_pagar || 0)]));
        const clientesMap = new Map();

        for (const row of rows) {
            if (!clientesMap.has(row.cliente_id)) {
                clientesMap.set(row.cliente_id, {
                    cliente_id: row.cliente_id,
                    cliente_nombre: row.cliente_nombre,
                    cliente_apellido: row.cliente_apellido,
                    cliente_activo: row.cliente_activo === 1,
                    total_por_pagar: deudasMap.get(row.cliente_id) || 0,
                    meses: mesesIniciales(anio, row.cliente_creado_en)
                });
            }

            if (row.mes_numero >= 1 && row.mes_numero <= MESES_DEL_ANIO) {
                const estadoMes = row.pagada === 1 ? 'pagada' : (row.total_facturas_mes > 0 ? 'pendiente' : 'sin_factura');
                clientesMap.get(row.cliente_id).meses[row.mes_numero] = estadoMes;
            }
        }

        let data = Array.from(clientesMap.values());
        if (soloConDeuda) {
            data = data.filter(item => Number(item.total_por_pagar || 0) > 0);
        }
        const granTotalPorPagar = data.reduce((acc, item) => acc + Number(item.total_por_pagar || 0), 0);

        return { data, granTotalPorPagar };
    }
}

// Meses anteriores a la creación del cliente no aplican; el resto empieza "sin factura"
function mesesIniciales(anio, creadoEn) {
    const fechaCreacion = creadoEn ? new Date(creadoEn) : null;
    const anioCreacion = fechaCreacion ? fechaCreacion.getUTCFullYear() : null;
    const mesCreacion = fechaCreacion ? (fechaCreacion.getUTCMonth() + 1) : null;
    const meses = {};

    for (let mes = 1; mes <= MESES_DEL_ANIO; mes++) {
        const antesDeCrearse = anioCreacion !== null && (anio < anioCreacion || (anio === anioCreacion && mes < mesCreacion));
        meses[mes] = antesDeCrearse ? 'no_aplica' : 'sin_factura';
    }
    return meses;
}

module.exports = { FacturacionService };
