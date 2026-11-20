// @ts-check

const MESES_DEL_ANIO = 12;

class DashboardService {
    /** @param {{ dashboardRepository: import('../../repositories/DashboardRepository').DashboardRepository }} deps */
    constructor({ dashboardRepository }) {
        this.dashboard = dashboardRepository;
    }

    async estadisticas() {
        const totalClientes = await this.dashboard.totalClientesActivos();
        const ingresosMensuales = await this.dashboard.ingresosDelMes();
        const ingresosEsperados = await this.dashboard.ingresoEsperadoDelMes();
        const anchoBandaTotal = await this.dashboard.anchoBandaTotal();
        const ticketsPendientes = await this.dashboard.ticketsPendientes();

        // Un total por mes (enero = posición 0); los meses sin ingresos quedan en 0
        const ingresosAnuales = new Array(MESES_DEL_ANIO).fill(0);
        (await this.dashboard.ingresosPorMesDelAnio()).forEach(({ mes, total }) => {
            ingresosAnuales[mes - 1] = parseFloat(total);
        });

        const distribucionPlanes = Object.fromEntries(
            (await this.dashboard.clientesPorPlan()).map(({ nombre, total }) => [nombre, total])
        );

        const ultimasInstalaciones = await this.dashboard.ultimasInstalaciones();

        return {
            totalClientes,
            ingresosMensuales,
            ingresosEsperados,
            anchoBandaTotal,
            ticketsPendientes,
            ingresosAnuales,
            distribucionPlanes,
            ultimasInstalaciones
        };
    }
}

module.exports = { DashboardService };
