// Optional production webhook template for Supabase Edge Functions / Node server.
// Do NOT put RAZORPAY_KEY_SECRET in frontend.
// Verify Razorpay webhook signature, then mark payment verified.

/*
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const body = await req.text();
  const signature = req.headers.get('x-razorpay-signature');
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  if (signature !== expected) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(body);
  const payment = event?.payload?.payment?.entity;
  const stackopsPaymentId = payment?.notes?.stackops_payment_id;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (event.event === 'payment.captured' && stackopsPaymentId) {
    await supabase.from('payments').update({
      status: 'captured',
      provider_payment_id: payment.id,
      verified_at: new Date().toISOString(),
      raw_response: payment
    }).eq('id', stackopsPaymentId);
  }

  return new Response('ok');
}
*/
