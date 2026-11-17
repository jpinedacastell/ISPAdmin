const db = require('../config/database');
const bcrypt = require('bcryptjs');

class Admin {
  static async autenticar(usuario, password) {
    try {
      const [admins] = await db.execute(
        'SELECT * FROM administradores WHERE usuario = ?',
        [usuario]
      );

      if (admins.length === 0) {
        return null;
      }

      const admin = admins[0];
      const passwordValido = await bcrypt.compare(password, admin.password);

      if (!passwordValido) {
        return null;
      }

      // No enviar el password en la respuesta
      delete admin.password;
      return admin;
    } catch (error) {
      console.error('Error en autenticación:', error);
      throw error;
    }
  }

  static async obtenerPorId(id) {
    const [admins] = await db.execute(
      'SELECT id, usuario, nombre, email, created_at, updated_at FROM administradores WHERE id = ?',
      [id]
    );
    return admins[0];
  }

  static async cambiarPassword(id, passwordActual, passwordNuevo) {
    try {
      // Verificar password actual
      const [admins] = await db.execute('SELECT password FROM administradores WHERE id = ?', [id]);
      if (admins.length === 0) {
        return false;
      }

      const passwordValido = await bcrypt.compare(passwordActual, admins[0].password);
      if (!passwordValido) {
        return false;
      }

      // Hashear nuevo password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(passwordNuevo, salt);

      // Actualizar password
      const [result] = await db.execute(
        'UPDATE administradores SET password = ? WHERE id = ?',
        [passwordHash, id]
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error al cambiar password:', error);
      throw error;
    }
  }
}

module.exports = Admin; 