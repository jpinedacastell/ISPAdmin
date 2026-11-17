const facturaModel = require('../models/facturaModel');

exports.aplicarDescuento = async (req, res) => {
    try {
        console.log('Datos recibidos:', req.body);
        const { idFactura, porcentaje, motivo } = req.body;
        
        // Validar datos
        if (!idFactura || !porcentaje || !motivo) {
            console.log('Error: Faltan campos requeridos');
            return res.status(400).json({
                message: 'Todos los campos son requeridos'
            });
        }

        // Verificar que el porcentaje esté entre 0 y 100
        if (porcentaje < 0 || porcentaje > 100) {
            console.log('Error: Porcentaje inválido', porcentaje);
            return res.status(400).json({
                message: 'El porcentaje debe estar entre 0 y 100'
            });
        }

        // Obtener la factura
        console.log('Buscando factura con ID:', idFactura);
        const factura = await facturaModel.findById(idFactura);
        if (!factura) {
            console.log('Error: Factura no encontrada');
            return res.status(404).json({
                message: 'Factura no encontrada'
            });
        }

        // Calcular nuevo monto
        const descuento = (factura.monto * porcentaje) / 100;
        const nuevoMonto = factura.monto - descuento;
        console.log('Monto original:', factura.monto);
        console.log('Descuento:', descuento);
        console.log('Nuevo monto:', nuevoMonto);

        // Actualizar la factura
        const updates = {
            monto: nuevoMonto,
            descuentos: [...(factura.descuentos || []), {
                porcentaje,
                motivo,
                fecha: new Date(),
                monto: descuento
            }]
        };
        console.log('Actualizando factura con:', updates);

        await facturaModel.findByIdAndUpdate(idFactura, updates);
        console.log('Factura actualizada exitosamente');

        res.status(200).json({
            message: 'Descuento aplicado exitosamente',
            factura: {
                ...factura,
                monto: nuevoMonto,
                descuentos: [...(factura.descuentos || []), {
                    porcentaje,
                    motivo,
                    fecha: new Date(),
                    monto: descuento
                }]
            }
        });
    } catch (error) {
        console.error('Error completo:', error);
        console.error('Mensaje de error:', error.message);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            message: 'Error al aplicar el descuento',
            error: error.message
        });
    }
};

exports.aplicarProrroga = async (req, res) => {
    try {
        const { idFactura, dias, motivo } = req.body;
        
        // Validar datos
        if (!idFactura || !dias || !motivo) {
            return res.status(400).json({
                message: 'Todos los campos son requeridos'
            });
        }

        // Verificar que los días sean positivos
        if (dias <= 0) {
            return res.status(400).json({
                message: 'Los días de prórroga deben ser positivos'
            });
        }

        // Obtener la factura
        const factura = await facturaModel.findById(idFactura);
        if (!factura) {
            return res.status(404).json({
                message: 'Factura no encontrada'
            });
        }

        // Calcular nueva fecha de vencimiento
        const nuevaFechaVencimiento = new Date(factura.fecha_vencimiento);
        nuevaFechaVencimiento.setDate(nuevaFechaVencimiento.getDate() + dias);

        // Actualizar la factura
        const updates = {
            fecha_vencimiento: nuevaFechaVencimiento,
            prorroga: [...(factura.prorroga || []), {
                dias,
                motivo,
                fecha: new Date()
            }]
        };

        await facturaModel.findByIdAndUpdate(idFactura, updates);

        res.status(200).json({
            message: 'Prórroga aplicada exitosamente',
            factura: {
                ...factura,
                fecha_vencimiento: nuevaFechaVencimiento,
                prorroga: [...(factura.prorroga || []), {
                    dias,
                    motivo,
                    fecha: new Date()
                }]
            }
        });
    } catch (error) {
        console.error('Error al aplicar prórroga:', error);
        res.status(500).json({
            message: 'Error al aplicar la prórroga'
        });
    }
};
