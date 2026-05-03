# StackOps Razorpay Live Setup

## Goal
Money should come to **your Razorpay account**. It does not matter whether the account is old or new, as long as:

1. KYC is complete.
2. Settlement bank account is yours.
3. You paste the correct Razorpay key into `config.js`.

## Step 1 — Get Razorpay keys
Razorpay Dashboard → Settings → API Keys.

Use test mode first:

```js
RAZORPAY_KEY_ID: 'rzp_test_xxxxx'
```

When ready for real money, switch Razorpay dashboard to Live Mode and use:

```js
RAZORPAY_KEY_ID: 'rzp_live_xxxxx'
```

## Step 2 — Add payment link fallback
In `config.js`:

```js
RAZORPAY_PAYMENT_LINK: 'https://razorpay.me/@YourHandle'
```

If checkout key is missing, the app opens your payment link so users can still pay you.

## Step 3 — Run SQL
Run:

```sql
razorpay-full-safe.sql
```

## Step 4 — Important security note
The current static GitHub Pages version can collect payments through Razorpay Checkout and record payment success in Supabase.

For automatic premium unlocks that cannot be faked, use a secure backend or Supabase Edge Function webhook with Razorpay signature verification.

Never put `RAZORPAY_KEY_SECRET` inside frontend files.

## Step 5 — Recommended launch flow
1. Use test key.
2. Test ₹1 checkout.
3. Check payment in Razorpay dashboard.
4. Switch to live key.
5. Advertise.
