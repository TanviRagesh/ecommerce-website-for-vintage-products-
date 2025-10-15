const Order = require('../models/Order');
const { createOrder: paypalCreateOrder, captureOrder: paypalCaptureOrder } = require('../services/paypalService');
const { sendOrderEmail } = require('../services/emailService');

function calculateTotals(items, shippingCost = 0, taxRate = 0) {
  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const tax = subtotal * taxRate;
  const total = subtotal + shippingCost + tax;
  return { subtotal, tax, total };
}

exports.placeOrder = async (req, res) => {
  try {
    const { items, customerEmail, shippingAddress, billingAddress, shippingCost = 0, taxRate = 0, currency = 'USD', notes } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'Items are required' });
    if (!customerEmail) return res.status(400).json({ message: 'customerEmail is required' });
    if (!shippingAddress) return res.status(400).json({ message: 'shippingAddress is required' });

    const { subtotal, tax, total } = calculateTotals(items, shippingCost, taxRate);

    const order = await Order.create({
      items,
      customerEmail,
      shippingAddress,
      billingAddress,
      subtotal,
      shippingCost,
      tax,
      total,
      currency,
      status: 'created',
      notes,
    });

    // Create PayPal order
    const pp = await paypalCreateOrder(total, currency, order._id.toString());
    const paypalOrderId = pp.id;
    order.paypalOrderId = paypalOrderId;
    await order.save();

    // Send confirmation email of order placement
    try {
      await sendOrderEmail(customerEmail, {
        order_id: order._id.toString(),
        total_amount: total.toFixed(2),
        currency,
        status: 'created',
      });
    } catch (e) {
      // Don't fail the request for email issues
      console.warn('Email sending failed:', e.message);
    }

    res.status(201).json({
      orderId: order._id,
      paypalOrderId,
      approveUrl: (pp.links || []).find(l => l.rel === 'approve')?.href,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to place order' });
  }
};

exports.capturePayment = async (req, res) => {
  try {
    const { id } = req.params; // order id
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.paypalOrderId) return res.status(400).json({ message: 'PayPal order missing' });

    const capture = await paypalCaptureOrder(order.paypalOrderId);
    const captureId = capture?.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    if (captureId) {
      order.status = 'paid';
      order.paypalCaptureId = captureId;
      await order.save();

      try {
        await sendOrderEmail(order.customerEmail, {
          order_id: order._id.toString(),
          total_amount: order.total.toFixed(2),
          currency: order.currency,
          status: 'paid',
        });
      } catch (e) {
        console.warn('Email sending failed:', e.message);
      }

      return res.json({ success: true, captureId });
    }

    res.status(400).json({ message: 'Capture failed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to capture payment' });
  }
};
