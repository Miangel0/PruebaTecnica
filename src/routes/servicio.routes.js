const { Router } = require('express');
const servicioController = require('../controllers/servicio.controller');

const router = Router();

// GET /api/servicios
router.get('/', servicioController.listar);

module.exports = router;
