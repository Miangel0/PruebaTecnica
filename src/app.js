require('dotenv').config();
const path = require('path');
const express = require('express');

const clienteRoutes = require('./routes/cliente.routes');
const servicioRoutes = require('./routes/servicio.routes');
const reservaRoutes = require('./routes/reserva.routes');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (req, res) => {
    res.send(`<p>Holap</p>`)
});

app.use('/api/clientes', clienteRoutes);
app.use('/api/servicios', servicioRoutes);
app.use('/api/reservas', reservaRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejador de errores centralizado
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto http://localhost:${PORT}`));

module.exports = app;
