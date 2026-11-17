const Cliente = require('../models/Cliente');

const clienteController = {
  // Crear nuevo cliente
  async crear(req, res) {
    try {
      const cliente = await Cliente.crear(req.body);
      res.status(201).json({ id: cliente });
    } catch (error) {
      res.status(500).json({ error: 'Error al crear el cliente' });
    }
  },

  // Obtener todos los clientes
  async obtenerTodos(req, res) {
    try {
      const clientes = await Cliente.obtenerTodos();
      res.json(clientes);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener los clientes' });
    }
  },

  // Obtener un cliente por ID
  async obtenerPorId(req, res) {
    try {
      const cliente = await Cliente.obtenerPorId(req.params.id);
      if (cliente) {
        res.json(cliente);
      } else {
        res.status(404).json({ error: 'Cliente no encontrado' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener el cliente' });
    }
  },

  // Actualizar un cliente
  async actualizar(req, res) {
    try {
      const actualizado = await Cliente.actualizar(req.params.id, req.body);
      if (actualizado) {
        res.json({ mensaje: 'Cliente actualizado correctamente' });
      } else {
        res.status(404).json({ error: 'Cliente no encontrado' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Error al actualizar el cliente' });
    }
  },

  // Eliminar un cliente
  async eliminar(req, res) {
    try {
      const eliminado = await Cliente.eliminar(req.params.id);
      if (eliminado) {
        res.json({ mensaje: 'Cliente eliminado correctamente' });
      } else {
        res.status(404).json({ error: 'Cliente no encontrado' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Error al eliminar el cliente' });
    }
  }
};

module.exports = clienteController; 