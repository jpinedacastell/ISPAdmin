const pool = require('../config/database');

const facturaModel = {
    findById: async (id) => {
        try {
            console.log('Buscando factura con ID:', id);
            const [results] = await pool.query(`
                SELECT 
                    f.*, 
                    c.nombre as cliente_nombre,
                    c.apellido as cliente_apellido,
                    c.dni as cliente_dni,
                    c.email as cliente_email,
                    c.telefono as cliente_telefono,
                    c.direccion as cliente_direccion,
                    p.nombre as plan_nombre,
                    p.velocidad_descarga,
                    p.velocidad_subida,
                    p.descripcion as plan_descripcion
                FROM facturas f
                INNER JOIN clientes c ON f.cliente_id = c.id
                INNER JOIN planes p ON f.plan_id = p.id
                WHERE f.id = ?`, [id]);
            
            console.log('Resultados de la consulta:', results);
            const factura = results[0];
            if (factura) {
                console.log('Factura encontrada:', factura);
                // Convertir campos JSON de string a objeto si son strings
                if (typeof factura.descuentos === 'string') {
                    factura.descuentos = JSON.parse(factura.descuentos);
                }
                if (typeof factura.prorroga === 'string') {
                    factura.prorroga = JSON.parse(factura.prorroga);
                }
            }
            return factura;
        } catch (error) {
            console.error('Error en findById:', error);
            console.error('Stack trace:', error.stack);
            throw error;
        }
    },

    findByIdAndUpdate: async (id, updates) => {
        try {
            console.log('Actualizando factura con ID:', id);
            console.log('Actualizaciones:', updates);
            
            // Convertir objetos JSON a string para almacenamiento
            if (updates.descuentos) {
                updates.descuentos = JSON.stringify(updates.descuentos);
            }
            if (updates.prorroga) {
                updates.prorroga = JSON.stringify(updates.prorroga);
            }

            const setClause = Object.entries(updates)
                .map(([key, value]) => `${key} = ?`)
                .join(', ');
            
            const values = Object.values(updates);
            values.push(id);
            
            console.log('Query a ejecutar:', `UPDATE facturas SET ${setClause} WHERE id = ?`);
            console.log('Valores:', values);
            
            const [result] = await connection.promise().query(
                `UPDATE facturas SET ${setClause} WHERE id = ?`,
                values
            );
            console.log('Resultado de la actualización:', result);
            return result;
        } catch (error) {
            console.error('Error en findByIdAndUpdate:', error);
            console.error('Stack trace:', error.stack);
            throw error;
        }
    },

    findByIdAndUpdate: async (id, updates) => {
        try {
            // Convertir objetos JSON a string para almacenamiento
            if (updates.descuentos) {
                updates.descuentos = JSON.stringify(updates.descuentos);
            }
            if (updates.prorroga) {
                updates.prorroga = JSON.stringify(updates.prorroga);
            }

            const setClause = Object.entries(updates)
                .map(([key, value]) => `${key} = ?`)
                .join(', ');
            
            const values = Object.values(updates);
            values.push(id);
            
            const [result] = await connection.promise().query(
                `UPDATE facturas SET ${setClause} WHERE id = ?`,
                values
            );
            return result;
        } catch (error) {
            throw error;
        }
    },

    create: async (data) => {
        return new Promise((resolve, reject) => {
            // Convertir objetos JSON a string para almacenamiento
            if (data.descuentos) {
                data.descuentos = JSON.stringify(data.descuentos);
            }
            if (data.prorroga) {
                data.prorroga = JSON.stringify(data.prorroga);
            }

            connection.query(
                'INSERT INTO facturas SET ?',
                data,
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        });
    }
};

module.exports = facturaModel;
