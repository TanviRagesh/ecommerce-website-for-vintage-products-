const express = require('express');
const router = express.Router();
const { placeOrder, capturePayment } = require('../controllers/orderController');

router.post('/', placeOrder);
router.post('/:id/capture', capturePayment);

module.exports = router;
