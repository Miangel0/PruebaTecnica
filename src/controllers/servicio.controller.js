const pool = require('../config/db');

// GET /api/servicios
exports.listar = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, descripcion, duracion_min, precio FROM servicio ORDER BY id'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};
