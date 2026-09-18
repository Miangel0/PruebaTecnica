const pool = require('../config/db');

// GET /api/clientes?nombre=xxx&apellido=xxx
// filtrar clientes por nombre o apellido al momento de seleccionar para una reserva
exports.listar = async (req, res, next) => {
  try {
    const { nombre, apellido } = req.query;
    const condiciones = [];
    const valores = [];

    if (nombre) {
      valores.push(`%${nombre}%`);
      condiciones.push(`nombre ILIKE $${valores.length}`);
    }
    if (apellido) {
      valores.push(`%${apellido}%`);
      condiciones.push(`apellido ILIKE $${valores.length}`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT id, nombre, apellido, correo, telefono FROM cliente ${where} ORDER BY id`,
      valores
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};
