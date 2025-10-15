// Using EmailJS REST API
const fetch = require('node-fetch');

const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const EMAILJS_BASE_URL = process.env.EMAILJS_BASE_URL || 'https://api.emailjs.com/api/v1.0/email/send';

async function sendOrderEmail(toEmail, templateParams) {
  const resp = await fetch(EMAILJS_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email: toEmail,
        ...templateParams,
      },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`EmailJS error: ${resp.status} ${text}`);
  }
  return true;
}

module.exports = { sendOrderEmail };
