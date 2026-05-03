# StackOps Razorpay Auto Premium Unlock Setup

## SQL REQUIRED: YES
Run `auto-premium-unlock-safe.sql` in Supabase SQL Editor.

## What goes in frontend config.js
Use only Razorpay **Key ID**:

```js
RAZORPAY_KEY_ID: 'rzp_live_xxxxx'
```

Never put Razorpay Key Secret in frontend/GitHub Pages.

## Deploy Supabase Edge Function
Create a Supabase Edge Function named:

```txt
razorpay-webhook
```

Use the code from:

```txt
supabase-edge-function-razorpay-webhook.ts
```

Set these Supabase secrets:

```txt
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_from_razorpay
```

## Razorpay Webhook URL
After deployment, set Razorpay webhook URL to:

```txt
https://YOUR_PROJECT_REF.functions.supabase.co/razorpay-webhook
```

Enable event:

```txt
payment.captured
```

## How auto unlock works
1. User buys a plan on StackOps.
2. Frontend creates a `payments` row with plan info.
3. Razorpay checkout opens.
4. Razorpay sends verified webhook to Supabase Edge Function.
5. Edge Function verifies signature.
6. Edge Function updates payment to `unlocked`.
7. User profile gets plan, title, badge, XP, premium_until.

## Important
If you use only Razorpay Payment Links, auto unlock is not reliable because the site cannot attach the StackOps payment ID in notes. Use in-site checkout for automatic unlock.
