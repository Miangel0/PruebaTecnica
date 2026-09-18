const pool = require('../config/db');

const TRANSICIONES_VALIDAS = {
  pendiente: ['confirmada', 'cancelada'],
};


class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// POST /api/reservas
// body: { id_cliente, fecha_cita, observaciones, servicios: [{ id_servicio, cantidad }] }
exports.crear = async (req, res, next) => {
  const { id_cliente, fecha_cita, observaciones, servicios } = req.body;

  if (!id_cliente || !fecha_cita || !Array.isArray(servicios) || servicios.length === 0) {
    return res.status(400).json({ error: 'id_cliente, fecha_cita y al menos un servicio son obligatorios' });
  }

  // no permitir fecha_cita en el pasado
  if (new Date(fecha_cita) < new Date()) {
    return res.status(400).json({ error: 'La fecha de la cita no puede estar en el pasado' });
  }

  // si el mismo servicio aparece más de una vez, sumar cantidades en vez de duplicar la línea
  const cantidadPorServicio = new Map();
  for (const item of servicios) {
    if (!item.id_servicio || !item.cantidad || item.cantidad <= 0) {
      return res.status(400).json({ error: 'Cada servicio necesita id_servicio y cantidad > 0' });
    }
    const previa = cantidadPorServicio.get(item.id_servicio) || 0;
    cantidadPorServicio.set(item.id_servicio, previa + item.cantidad);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cliente = await client.query('SELECT id FROM cliente WHERE id = $1', [id_cliente]);
    if (cliente.rowCount === 0) {
      throw new HttpError(404, `No existe el cliente con id ${id_cliente}`);
    }

    // Reserva con total en 0, lo actualizamos al final
    const { rows: [reserva] } = await client.query(
      `INSERT INTO reserva (fecha_cita, id_cliente, observaciones, estado, total)
       VALUES ($1, $2, $3, 'pendiente', 0)
       RETURNING *`,
      [fecha_cita, id_cliente, observaciones || null]
    );

    const lineasDetalle = [];
    let total = 0;

    for (const [id_servicio, cantidad] of cantidadPorServicio) {
      const { rows: [servicio] } = await client.query('SELECT precio FROM servicio WHERE id = $1', [id_servicio]);
      if (!servicio) {
        throw new HttpError(400, `No existe el servicio con id ${id_servicio}`);
      }

      const subtotal = Number((servicio.precio * cantidad).toFixed(2));
      total += subtotal;

      const { rows: [linea] } = await client.query(
        `INSERT INTO reserva_detalle (id_reserva, id_servicio, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [reserva.id, id_servicio, cantidad, servicio.precio, subtotal]
      );
      lineasDetalle.push(linea);
    }

    const { rows: [reservaFinal] } = await client.query(
      'UPDATE reserva SET total = $1 WHERE id = $2 RETURNING *',
      [Number(total.toFixed(2)), reserva.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ ...reservaFinal, servicios: lineasDetalle });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  } finally {
    client.release();
  }
};

// GET /api/reservas?estado=pendiente
exports.listar = async (req, res, next) => {
  try {
    const { estado } = req.query;
    const condiciones = [];
    const valores = [];

    if (estado) {
      valores.push(estado);
      condiciones.push(`r.estado = $${valores.length}`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT r.id,
              c.nombre || ' ' || c.apellido AS cliente,
              r.fecha_cita,
              r.total,
              r.estado
       FROM reserva r
       JOIN cliente c ON c.id = r.id_cliente
       ${where}
       ORDER BY r.id`,
      valores
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/reservas/:id  (detalle completo — opcional 6.2.4)
exports.detalle = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const resultReserva = await pool.query(
      `SELECT r.*, c.nombre, c.apellido, c.correo, c.telefono
       FROM reserva r
       JOIN cliente c ON c.id = r.id_cliente
       WHERE r.id = $1`,
      [id]
    );
    if (resultReserva.rowCount === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }
    const r = resultReserva.rows[0];

    const resultDetalle = await pool.query(
      `SELECT s.nombre AS servicio, d.cantidad, d.precio_unitario, d.subtotal
       FROM reserva_detalle d
       JOIN servicio s ON s.id = d.id_servicio
       WHERE d.id_reserva = $1`,
      [id]
    );

    res.json({
      id: r.id,
      cliente: { nombre: r.nombre, apellido: r.apellido, correo: r.correo, telefono: r.telefono },
      fecha_registro: r.fecha_registro,
      fecha_cita: r.fecha_cita,
      estado: r.estado,
      observaciones: r.observaciones,
      total: r.total,
      servicios: resultDetalle.rows,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/reservas/:id/estado   body: { estado }
exports.cambiarEstado = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { estado: nuevoEstado } = req.body;

    const result = await pool.query('SELECT * FROM reserva WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }
    const reserva = result.rows[0];

    if (reserva.estado === 'cancelada') {
      return res.status(400).json({ error: 'No se puede modificar una reserva ya cancelada' });
    }

    const permitidos = TRANSICIONES_VALIDAS[reserva.estado] || [];
    if (!permitidos.includes(nuevoEstado)) {
      return res.status(400).json({ error: `Transición inválida: ${reserva.estado} -> ${nuevoEstado}` });
    }

    const resultUpdate = await pool.query(
      'UPDATE reserva SET estado = $1 WHERE id = $2 RETURNING *',
      [nuevoEstado, id]
    );
    res.json(resultUpdate.rows[0]);
  } catch (err) {
    next(err);
  }
};
