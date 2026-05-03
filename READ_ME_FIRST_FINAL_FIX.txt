StackOps Final Razorpay + Seller Fix

SQL REQUIRED: YES
Run RUN_THIS_FINAL_SAFE.sql in Supabase SQL Editor.

What was fixed:
- Apply to Sell now inserts correct seller_applications fields.
- Removed unsupported Supabase .catch() usage that caused mobile errors.
- Razorpay checkout no longer shows failed modal by default.
- Payments open Razorpay payment link safely until your live checkout is approved.

Razorpay setup:
- config.js has RAZORPAY_CHECKOUT_ENABLED: false
- This means buttons open RAZORPAY_PAYMENT_LINK directly.
- When Razorpay live checkout is approved, set RAZORPAY_CHECKOUT_ENABLED: true.
- Never put Razorpay secret key in frontend.
