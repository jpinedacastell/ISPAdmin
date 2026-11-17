const db = require('../config/database');

class Cliente {
  static async crear(cliente) {
    const [result] = await db.execute(
      'INSERT INTO clientes (nombre, apellido, email, telefono, direccion) VALUES (?, ?, ?, ?, ?)',
      [cliente.nombre, cliente.apellido, cliente.email, cliente.telefono, cliente.direccion]
    );
    return result.insertId;
  }

  static async obtenerTodos() {
    const [clientes] = await db.query('SELECT * FROM clientes');
    return clientes;
  }

  static async obtenerPorId(id) {
    const [clientes] = await db.execute('SELECT * FROM clientes WHERE id = ?', [id]);
    return clientes[0];
  }

  static async actualizar(id, cliente) {
    const [result] = await db.execute(
      'UPDATE clientes SET nombre = ?, apellido = ?, email = ?, telefono = ?, direccion = ? WHERE id = ?',
      [cliente.nombre, cliente.apellido, cliente.email, cliente.telefono, cliente.direccion, id]
    );
    return result.affectedRows > 0;
  }

  static async eliminar(id) {
    const [result] = await db.execute('DELETE FROM clientes WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Cliente; 