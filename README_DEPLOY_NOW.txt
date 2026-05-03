STACKOPS FINAL DEPLOY NOTES

1) Run SQL in Supabase:
   FINAL_DEPLOY_MANUAL_UPI_SQL.sql

2) Upload these files to GitHub Pages.
   Best method: replace old repo website files with this ZIP contents.
   Keep only GitHub-specific files if you use them: .git, CNAME, README if needed.

3) Payment flow now uses Manual UPI only:
   UPI: ralhanx@ptaxis
   QR: upi-qr.jpeg
   User must upload screenshot/proof and UTR/reference number.
   User sees: payment reflects within 24–48 hours after admin verification.

4) Admin flow:
   Login with admin email.
   Open Admin panel.
   Manual Payment Requests shows pending orders.
   View Proof -> verify screenshot/UTR -> Approve or Reject.
   Mark Seller Paid after paying seller manually.

5) Razorpay is no longer used for active checkout because the gaming category was rejected.
