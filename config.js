window.STACKOPS_CONFIG = {
  SUPABASE_URL: 'https://ffagzruaerzftqwmnbmp.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmYWd6cnVhZXJ6ZnRxd21uYm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTYyMTcsImV4cCI6MjA5MDczMjIxN30.H_bI5O0YLMOjvnyGyi6HIq1scBHydRebB3lx7nJkVzc',
  // Razorpay disabled: StackOps now uses manual UPI middleman payments.
  RAZORPAY_KEY_ID: '',
  RAZORPAY_CHECKOUT_ENABLED: false,
  RAZORPAY_PAYMENT_LINK: '',
  // Supabase Edge Function URL for verified auto-unlocks.
  // After deploying the webhook function, paste:
  // https://YOUR_PROJECT_REF.functions.supabase.co/razorpay-webhook
  RAZORPAY_WEBHOOK_FUNCTION_URL: '',
  PAYMENT_VERIFY_POLL_SECONDS: 45,
  RAZORPAY_BUSINESS_NAME: 'StackOps',
  RAZORPAY_CONTACT_EMAIL: 'kiratveersinghralhan@gmail.com',

  // Manual UPI fallback: payments come to YOU first. Admin verifies proof, then seller payout is tracked.
  MANUAL_UPI_ID: 'ralhanx@ptaxis',
  MANUAL_UPI_QR_URL: 'upi-qr.jpeg',
  ADMIN_EMAILS: ['kiratveersinghralhan@gmail.com','qq299629@gmail.com'],
  DEFAULT_LANGUAGE: 'en',
  STORAGE_BUCKETS: {
    avatars: 'avatars',
    banners: 'banners',
    posts: 'posts'
  },
  COMMISSION_RULES: [
    { min: 0, max: 499, percent: 7 },
    { min: 500, max: 999, percent: 10 },
    { min: 1000, max: 1999, percent: 15 },
    { min: 2000, max: 2999, percent: 20 },
    { min: 3000, max: 4999, percent: 25 },
    { min: 5000, max: 9999999, percent: 30 }
  ]
};



