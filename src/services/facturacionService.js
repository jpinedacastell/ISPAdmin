const db = require('../config/database');

class FacturacionService {
    constructor() {
        this.abonosSchemaReady = false;
    }

    async ensureAbonosSchema(connection = db) {
        if (this.abonosSchemaReady) {
            return;
        }

        const requiredColumns = {
            monto_pagado: "ADD COLUMN monto_pagado DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Monto en efectivo aplicado a la factura'",
            pago_recibido: "ADD COLUMN pago_recibido DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Total efectivo recibido al cobrar la factura'",
            credito_aplicado: "ADD COLUMN credito_aplicado DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Saldo a favor aplicado a la factura'",
            abono_siguiente: "ADD COLUMN abono_siguiente DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Saldo a favor generado para próximas facturas'"
        };

        const [columns] = await connection.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'facturas'
              AND COLUMN_NAME IN (?)
        `, [Object.keys(requiredColumns)]);

        const existingColumns = new Set(columns.map(column => column.COLUMN_NAME));

        for (const [columnName, alterSql] of Object.entries(requiredColumns)) {
            if (!existingColumns.has(columnName)) {
                await connection.query(`ALTER TABLE facturas ${alterSql}`);
            }
        }

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

    async obtenerSaldoFavorCliente(clienteId, connection = db) {
        await this.ensureAbonosSchema(connection);

        const [rows] = await connection.query(`
            SELECT
                GREATEST(
                    COALESCE(SUM(abono_siguiente), 0) - COALESCE(SUM(credito_aplicado), 0),
                    0
                ) AS saldo_favor
            FROM facturas
            WHERE cliente_id = ?
        `, [clienteId]);

        return this.toMoney(rows[0]?.saldo_favor || 0);
    }

    async aplicarSaldoFavorAPendientes(clienteId, connection = db, facturaOrigenId = null) {
        await this.ensureAbonosSchema(connection);

        let saldoFavor = await this.obtenerSaldoFavorCliente(clienteId, connection);
        const facturasAbonadas = [];

        if (saldoFavor <= 0) {
            return facturasAbonadas;
        }

        const params = [clienteId];
        let excluirFacturaSql = '';

        if (facturaOrigenId) {
            excluirFacturaSql = 'AND id <> ?';
            params.push(facturaOrigenId);
        }

        const [facturasPendientes] = await connection.query(`
            SELECT *
            FROM facturas
            WHERE cliente_id = ?
              ${excluirFacturaSql}
              AND estado IN ('pendiente', 'vencida')
            ORDER BY mes_facturado ASC, fecha_emision ASC, id ASC
            FOR UPDATE
        `, params);

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

            await connection.query(`
                UPDATE facturas
                SET credito_aplicado = ?,
                    estado = ?,
                    fecha_pago = CASE WHEN ? THEN COALESCE(fecha_pago, CURDATE()) ELSE fecha_pago END,
                    metodo_pago = CASE WHEN ? THEN COALESCE(metodo_pago, 'Abono a favor') ELSE metodo_pago END
                WHERE id = ?
            `, [
                nuevoCreditoAplicado,
                quedaPagada ? 'pagada' : factura.estado,
                quedaPagada,
                quedaPagada,
                factura.id
            ]);

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
        let connection;
        try {
            connection = await db.getConnection();
            await this.ensureAbonosSchema(connection);
            await connection.beginTransaction();

            // Verificar si ya existe un descuento
            const [factura] = await connection.query('SELECT * FROM facturas WHERE id = ?', [idFactura]);
            if (!factura.length) {
                throw new Error('Factura no encontrada');
            }

            const facturaData = factura[0];
            if (facturaData.descuento_porcentaje > 0) {
                throw new Error('Ya existe un descuento aplicado a esta factura');
            }

            // Calcular descuento
            const descuento = (facturaData.monto * porcentaje) / 100;
            
            // Actualizar la factura
            const [result] = await connection.query(`
                UPDATE facturas 
                SET descuento_porcentaje = ?, 
                    descuento_monto = ?,
                    motivo_descuento = ?
                WHERE id = ?
            `, [porcentaje, descuento, motivo, idFactura]);

            if (result.affectedRows !== 1) {
                throw new Error('No se pudo actualizar la factura');
            }

            await connection.commit();

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
        } catch (error) {
            if (connection) {
                await connection.rollback();
            }
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
    async generarFacturasMensuales(forzarGeneracion = false, fechaEspecifica = null) {
        let connection;
        try {
            connection = await db.getConnection();
            await this.ensureAbonosSchema(connection);
            await connection.beginTransaction();
    
            // Obtener configuración
            const [config] = await connection.query('SELECT * FROM config_facturacion LIMIT 1');
            if (!config?.length) throw new Error('Configuración de facturación no encontrada');
            
            const configuracion = config[0];
    
            // Manejo de fechas CORREGIDO (versión definitiva)
            let fechaBase;
            if (fechaEspecifica) {
                // Parseo seguro de la fecha especificada (formato YYYY-MM)
                const [year, month] = fechaEspecifica.split('-').map(Number);
                
                // Validación estricta
                if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
                    throw new Error('Formato de fecha inválido. Use YYYY-MM con mes entre 01-12');
                }
                
                // Siempre usar el día 1 del mes seleccionado
                fechaBase = new Date(Date.UTC(year, month - 1, 1));
                
                // Validación adicional para asegurar el mes correcto
                if (fechaBase.getUTCMonth() + 1 !== month) {
                    throw new Error('Error en conversión de fecha. Mes no coincide');
                }

                // Asegurar que la fecha se guarde como YYYY-MM-01
                fechaBase = new Date(Date.UTC(fechaBase.getUTCFullYear(), fechaBase.getUTCMonth(), 1));
            } else {
                // Para generación automática: mes actual
                const now = new Date();
                // Si no es día 1, no permitir la generación automática
                if (now.getUTCDate() !== 1) {
                    return {
                        success: false,
                        message: 'La generación automática de facturas solo está permitida el día 1 de cada mes'
                    };
                }
                // Usar el mes actual
                fechaBase = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
            }
            
            // Validar día de generación solo para generación automática
            if (!forzarGeneracion && !fechaEspecifica) {
                const now = new Date();
                if (now.getUTCDate() !== 1) {
                    return {
                        success: false,
                        message: 'Las facturas solo se pueden generar automáticamente el día 1 de cada mes'
                    };
    
                }
            }
    
            // Verificar facturas existentes para el mes
            const [facturasExistentes] = await connection.query(
                'SELECT COUNT(*) as total FROM facturas WHERE DATE_FORMAT(mes_facturado, "%Y-%m") = ?',
                [fechaBase.toISOString().slice(0, 7)]
            );
    
            if (facturasExistentes[0].total > 0 && !forzarGeneracion) {
                return {
                    success: false,
                    message: 'Ya existen facturas generadas para el mes seleccionado'
                };
            }
    
            // Obtener clientes activos sin factura para el mes
            const [clientes] = await connection.query(`
                SELECT 
                    c.id as cliente_id,
                    c.nombre,
                    c.apellido,
                    c.email,
                    cp.plan_id,
                    p.nombre as plan_nombre,
                    p.precio
                FROM clientes c
                INNER JOIN cliente_plan cp ON c.id = cp.cliente_id
                INNER JOIN planes p ON cp.plan_id = p.id
                WHERE cp.activo = true
                AND cp.fecha_fin IS NULL
                AND NOT EXISTS (
                    SELECT 1 
                    FROM facturas f 
                    WHERE f.cliente_id = c.id 
                    AND DATE_FORMAT(f.mes_facturado, "%Y-%m") = ?
                )
            `, [fechaBase.toISOString().slice(0, 7)]);
    
            if (clientes.length === 0) {
                await connection.commit();
                return {
                    success: true,
                    message: 'No hay clientes pendientes de facturar este mes'
                };
            }
    
            let facturasGeneradas = 0;
            const errores = [];
    
            for (const cliente of clientes) {
                try {
                    // Incrementar número de factura
                    await connection.query(
                        'UPDATE config_facturacion SET ultimo_numero = ultimo_numero + 1 WHERE id = ?',
                        [configuracion.id]
                    );
    
                    const [result] = await connection.query(
                        'SELECT ultimo_numero FROM config_facturacion WHERE id = ?',
                        [configuracion.id]
                    );
                    
                    const numeroFactura = `${configuracion.prefijo_factura}${String(result[0].ultimo_numero).padStart(8, '0')}`;
    
                    // Calcular fechas
                    const fechaEmision = new Date();
                    const fechaVencimiento = new Date(fechaEmision);
                    fechaVencimiento.setDate(fechaVencimiento.getDate() + configuracion.dias_vencimiento);

                    // Formatear la fecha del mes facturado para asegurar que sea el día 1
                    const mesFacturado = `${fechaBase.getUTCFullYear()}-${String(fechaBase.getUTCMonth() + 1).padStart(2, '0')}-01`;

                    const saldoFavor = await this.obtenerSaldoFavorCliente(cliente.cliente_id, connection);
                    const creditoAplicado = this.toMoney(Math.min(saldoFavor, Number(cliente.precio || 0)));
                    const estadoFactura = creditoAplicado >= Number(cliente.precio || 0) ? 'pagada' : 'pendiente';
                    const fechaPago = estadoFactura === 'pagada' ? new Date() : null;
                    const metodoPago = estadoFactura === 'pagada' ? 'Abono a favor' : null;

                    // Insertar factura para el mes actual (adelantada)
                    await connection.query(`
                        INSERT INTO facturas (
                            cliente_id,
                            plan_id,
                            numero_factura,
                            fecha_emision,
                            fecha_vencimiento,
                            mes_facturado,
                            monto,
                            estado,
                            credito_aplicado,
                            fecha_pago,
                            metodo_pago
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        cliente.cliente_id,
                        cliente.plan_id,
                        numeroFactura,
                        fechaEmision,
                        fechaVencimiento,
                        mesFacturado, // Usando la fecha formateada con día 1
                        cliente.precio,
                        estadoFactura,
                        creditoAplicado,
                        fechaPago,
                        metodoPago
                    ]);
    
                    facturasGeneradas++;
                } catch (error) {
                    errores.push(`Error al generar factura para ${cliente.nombre} ${cliente.apellido}: ${error.message}`);
                }
            }
    
            if (errores.length > 0 && facturasGeneradas === 0) {
                await connection.rollback();
                throw new Error(`No se pudo generar ninguna factura: ${errores.join(', ')}`);
            } else {
                await connection.commit();
                return {
                    success: true,
                    message: `Se generaron ${facturasGeneradas} facturas correctamente${errores.length > 0 ? `. Hubo ${errores.length} errores: ${errores.join(', ')}` : ''}`,
                    facturasGeneradas,
                    errores
                };
            }
        } catch (error) {
            if (connection) await connection.rollback();
            console.error('Error en la generación de facturas:', error);
            throw error;
        } finally {
            if (connection) connection.release();
        }
    }

    async obtenerFacturasCliente(clienteId) {
        let connection;
        try {
            connection = await db.getConnection();
            await this.ensureAbonosSchema(connection);
            const [facturas] = await connection.query(`
                SELECT 
                    f.*,
                    GREATEST(
                        (f.monto - COALESCE(f.descuento_monto, 0)) -
                        COALESCE(f.monto_pagado, 0) -
                        COALESCE(f.credito_aplicado, 0),
                        0
                    ) AS saldo_pendiente,
                    c.nombre as cliente_nombre,
                    c.apellido as cliente_apellido,
                    p.nombre as plan_nombre,
                    p.velocidad_descarga,
                    p.velocidad_subida
                FROM facturas f
                INNER JOIN clientes c ON f.cliente_id = c.id
                INNER JOIN planes p ON f.plan_id = p.id
                WHERE f.cliente_id = ?
                ORDER BY f.fecha_emision DESC
            `, [clienteId]);

            return facturas;
        } catch (error) {
            console.error('Error al obtener facturas del cliente:', error);
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    async actualizarEstadoFactura(facturaId, estado, metodoPago = null) {
        let connection;
        try {
            connection = await db.getConnection();
            await this.ensureAbonosSchema(connection);
            await connection.beginTransaction();

            const fechaPago = estado === 'pagada' ? new Date() : null;

            if (estado === 'pagada') {
                const [facturas] = await connection.query('SELECT * FROM facturas WHERE id = ? FOR UPDATE', [facturaId]);

                if (!facturas.length) {
                    throw new Error('Factura no encontrada');
                }

                const saldoFactura = this.calcularSaldoFactura(facturas[0]);
                const nuevoMontoPagado = this.toMoney(Number(facturas[0].monto_pagado || 0) + saldoFactura);

                await connection.query(`
                    UPDATE facturas 
                    SET estado = ?,
                        fecha_pago = ?,
                        metodo_pago = ?,
                        monto_pagado = ?,
                        pago_recibido = GREATEST(pago_recibido, ?)
                    WHERE id = ?
                `, [estado, fechaPago, metodoPago, nuevoMontoPagado, nuevoMontoPagado, facturaId]);
            } else {
                await connection.query(`
                    UPDATE facturas 
                    SET estado = ?,
                        fecha_pago = ?,
                        metodo_pago = ?
                    WHERE id = ?
                `, [estado, fechaPago, metodoPago, facturaId]);
            }

            await connection.commit();

            return {
                success: true,
                message: 'Estado de factura actualizado correctamente'
            };
        } catch (error) {
            if (connection) {
                await connection.rollback();
            }
            console.error('Error al actualizar estado de factura:', error);
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    async obtenerFacturas() {
        let connection;
        try {
            connection = await db.getConnection();
            await this.ensureAbonosSchema(connection);
            const [facturas] = await connection.query(`
                SELECT 
                    f.*,
                    GREATEST(
                        (f.monto - COALESCE(f.descuento_monto, 0)) -
                        COALESCE(f.monto_pagado, 0) -
                        COALESCE(f.credito_aplicado, 0),
                        0
                    ) AS saldo_pendiente,
                    c.nombre as cliente_nombre,
                    c.apellido as cliente_apellido,
                    c.dni as cliente_dni,
                    c.email as cliente_email,
                    c.telefono as cliente_telefono,
                    c.direccion as cliente_direccion,
                    p.nombre as plan_nombre,
                    p.velocidad_descarga,
                    p.velocidad_subida
                FROM facturas f
                INNER JOIN clientes c ON f.cliente_id = c.id
                INNER JOIN planes p ON f.plan_id = p.id
                ORDER BY f.fecha_emision DESC
            `);

            return facturas;
        } catch (error) {
            console.error('Error al obtener facturas:', error);
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    async obtenerFactura(id) {
        let connection;
        try {
            connection = await db.getConnection();
            await this.ensureAbonosSchema(connection);
            const [facturas] = await connection.query(`
                SELECT 
                    f.*,
                    GREATEST(
                        (f.monto - COALESCE(f.descuento_monto, 0)) -
                        COALESCE(f.monto_pagado, 0) -
                        COALESCE(f.credito_aplicado, 0),
                        0
                    ) AS saldo_pendiente,
                    DATE_FORMAT(f.mes_facturado, '%Y-%m-01') as mes_facturado,
                    c.nombre as cliente_nombre,
                    c.apellido as cliente_apellido,
                    c.dni as cliente_dni,
                    c.email as cliente_email,
                    c.telefono as cliente_telefono,
                    c.direccion as cliente_direccion,
                    p.nombre as plan_nombre,
                    p.velocidad_descarga,
                    p.velocidad_subida
                FROM facturas f
                INNER JOIN clientes c ON f.cliente_id = c.id
                INNER JOIN planes p ON f.plan_id = p.id
                WHERE f.id = ?
            `, [id]);

            if (!facturas[0]) return null;

            const factura = facturas[0];
            
            // Asegurarnos de que la fecha del mes facturado sea correcta
            const [year, month] = factura.mes_facturado.split('-');
            factura.mes_facturado = `${year}-${month}-01`;
            
            // Parsear los descuentos desde JSON
            try {
                if (factura.descuentos) {
                    factura.descuentos = JSON.parse(factura.descuentos);
                } else {
                    factura.descuentos = [];
                }
            } catch (error) {
                console.error('Error al parsear descuentos:', error);
                factura.descuentos = [];
            }

            return factura;
        } catch (error) {
            console.error('Error al obtener factura:', error);
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    async registrarPagoFactura(idFactura, usuario, pago = {}) {
        let connection;
        try {
            connection = await db.getConnection();
            await this.ensureAbonosSchema(connection);
            await connection.beginTransaction();

            const [facturaInfo] = await connection.query('SELECT * FROM facturas WHERE id = ? FOR UPDATE', [idFactura]);

            if (!facturaInfo.length) {
                throw new Error('Factura no encontrada');
            }

            const factura = facturaInfo[0];
            const saldoAntes = this.calcularSaldoFactura(factura);
            const montoRecibido = this.toMoney(pago.monto_recibido ?? pago.monto ?? saldoAntes);
            const metodoPago = pago.metodo_pago || factura.metodo_pago || 'Efectivo';

            if (!Number.isFinite(montoRecibido) || montoRecibido <= 0) {
                throw new Error('El monto recibido debe ser mayor a cero');
            }

            const montoAplicado = this.toMoney(Math.min(montoRecibido, saldoAntes));
            const abonoGenerado = this.toMoney(Math.max(montoRecibido - saldoAntes, 0));
            const nuevoMontoPagado = this.toMoney(Number(factura.monto_pagado || 0) + montoAplicado);
            const nuevoPagoRecibido = this.toMoney(Number(factura.pago_recibido || 0) + montoRecibido);
            const nuevoAbonoSiguiente = this.toMoney(Number(factura.abono_siguiente || 0) + abonoGenerado);
            const saldoPendiente = this.toMoney(Math.max(saldoAntes - montoAplicado, 0));
            const quedaPagada = saldoPendiente <= 0;

            await connection.query(`
                UPDATE facturas
                SET monto_pagado = ?,
                    pago_recibido = ?,
                    abono_siguiente = ?,
                    estado = ?,
                    fecha_pago = CASE WHEN ? THEN CURDATE() ELSE fecha_pago END,
                    metodo_pago = ?
                WHERE id = ?
            `, [
                nuevoMontoPagado,
                nuevoPagoRecibido,
                nuevoAbonoSiguiente,
                quedaPagada ? 'pagada' : factura.estado,
                quedaPagada,
                metodoPago,
                idFactura
            ]);

            const descripcionAbono = abonoGenerado > 0
                ? ` con L ${abonoGenerado.toFixed(2)} de abono a favor`
                : '';

            await connection.query(
                `INSERT INTO movimientos_financieros 
                    (tipo, monto, descripcion, cliente_id, factura_id, usuario_id, usuario_nombre) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    'ingreso',
                    montoRecibido,
                    `Pago de factura #${idFactura}${descripcionAbono}`,
                    factura.cliente_id,
                    idFactura,
                    usuario.id, // Obtén el usuario de la sesión
                    usuario.nombre
                ]
            );

            const facturasAbonadas = abonoGenerado > 0
                ? await this.aplicarSaldoFavorAPendientes(factura.cliente_id, connection, idFactura)
                : [];

            await connection.commit();

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
        } catch (error) {
            if (connection) {
                await connection.rollback();
            }
            console.error('Error al registrar pago de factura:', error);
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
}

module.exports = new FacturacionService();
