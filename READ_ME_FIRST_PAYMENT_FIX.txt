FINAL PAYMENT FIX

1) Upload all files in this ZIP to GitHub Pages after deleting old website files.
2) Run FINAL_PAYMENT_NO_ERRORS_SQL.sql once in Supabase.
3) Test payment flow:
   - Buy Plan
   - Enter UTR/reference number
   - Upload screenshot
   - Submit Payment Proof
   - You should see: "Payment submitted. It will reflect in your account within 24–48 hours..."
4) Admin panel:
   - Manual Payment Orders should load.
   - Open proof / view image.
   - Approve or reject.

This version falls back to storing proof screenshot inside the database if Supabase Storage blocks upload, so the submit button will not silently fail.
