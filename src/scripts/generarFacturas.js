const facturacionService = require('../services/facturacionService');

async function generarFacturas() {
    try {
        console.log('Iniciando generación de facturas mensuales...');
        const resultado = await facturacionService.generarFacturasMensuales();
        console.log(resultado.message);
        process.exit(0);
    } catch (error) {
        console.error('Error al generar facturas:', error);
        process.exit(1);
    }
}

// Ejecutar el script
generarFacturas(); 