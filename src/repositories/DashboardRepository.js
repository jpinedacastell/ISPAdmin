// @ts-check

class DashboardRepository {
    /** @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} conexion */
    constructor(conexion) {
        this.conexion = conexion;
    }

    async #total(sql) {
        const [filas] = await this.conexion.query(sql);
        return filas[0].total;
    }

    totalClientesActivos() {
        return this.#total(`
                SELECT COUNT(DISTINCT cp.cliente_id) as total
                FROM cliente_plan cp
                WHERE cp.activo = 1
                  AND cp.fecha_fin IS NULL
            `);
    }

    /** Ingresos reales recibidos en caja durante el mes */
    ingresosDelMes() {
        return this.#total(`
                SELECT COALESCE(SUM(monto), 0) as total
                FROM movimientos_financieros
                WHERE tipo = 'ingreso'
                  AND MONTH(fecha) = MONTH(CURRENT_DATE())
                  AND YEAR(fecha) = YEAR(CURRENT_DATE())
            `);
    }

    /** Ingreso esperado del mes facturado actual (con descuento) */
    ingresoEsperadoDelMes() {
        return this.#total(`
                SELECT COALESCE(SUM(monto - COALESCE(descuento_monto, 0)), 0) as total
                FROM facturas
                WHERE MONTH(mes_facturado) = MONTH(CURRENT_DATE()) AND YEAR(mes_facturado) = YEAR(CURRENT_DATE())
            `);
    }

    anchoBandaTotal() {
        return this.#total(`
                SELECT COALESCE(SUM(p.velocidad_descarga), 0) as total
                FROM cliente_plan c JOIN planes p ON c.plan_id = p.id WHERE c.activo = 1
            `);
    }

    ticketsPendientes() {
        return this.#total("SELECT COUNT(*) as total FROM tickets WHERE estado = 'pendiente'");
    }

    /** @returns {Promise<{ mes: number, total: any }[]>} */
    async ingresosPorMesDelAnio() {
        const [filas] = await this.conexion.query(`
                SELECT MONTH(fecha) as mes, SUM(monto) as total
                FROM movimientos_financieros
                WHERE tipo = 'ingreso'
                  AND YEAR(fecha) = YEAR(CURRENT_DATE())
                GROUP BY MONTH(fecha)
                ORDER BY mes ASC
            `);
        return filas;
    }

    /** @returns {Promise<{ nombre: string, total: number }[]>} */
    async clientesPorPlan() {
        const [filas] = await this.conexion.query(`
                SELECT p.nombre, COUNT(c.id) as total
                FROM cliente_plan c
                JOIN planes p ON c.plan_id = p.id
                WHERE c.activo = 1
                GROUP BY p.nombre
            `);
        return filas;
    }

    async ultimasInstalaciones() {
        const [filas] = await this.conexion.query(`
                SELECT 
                    cl.nombre as cliente, 
                    p.nombre as plan, 
                    co.created_at as fecha, 
                    (CASE WHEN co.activo = 1 THEN 'activo' ELSE 'inactivo' END) as estado
                FROM cliente_plan co
                JOIN clientes cl ON co.cliente_id = cl.id
                JOIN planes p ON co.plan_id = p.id
                ORDER BY co.created_at DESC
                LIMIT 5
            `);
        return filas;
    }
}

module.exports = { DashboardRepository };
