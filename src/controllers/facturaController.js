const facturacionService = require('../services/facturacionService');

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

        const factura = await facturacionService.aplicarProrroga(idFactura, dias, motivo);
        if (!factura) {
            return res.status(404).json({
                message: 'Factura no encontrada'
            });
        }

        res.status(200).json({
            message: 'Prórroga aplicada exitosamente',
            factura
        });
    } catch (error) {
        console.error('Error al aplicar prórroga:', error);
        res.status(500).json({
            message: 'Error al aplicar la prórroga'
        });
    }
};
