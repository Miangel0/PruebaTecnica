const { Router } = require('express');
const clienteController = require('../controllers/cliente.controller');

const router = Router();

// GET /api/clientes?nombre=&apellido=  (requisito 6: búsqueda de clientes)
router.get('/', clienteController.listar);

module.exports = router;
