const { Router } = require('express');
const reservaController = require('../controllers/reserva.controller');

const router = Router();

// Registrar una nueva reserva
router.post('/', reservaController.crear);

// Listar reservas (con filtro opcional por estado)
router.get('/', reservaController.listar);

// Cambiar el estado de una reserva
router.patch('/:id/estado', reservaController.cambiarEstado);

// Ver el detalle de una reserva (opcional)
router.get('/:id', reservaController.detalle);

module.exports = router;
