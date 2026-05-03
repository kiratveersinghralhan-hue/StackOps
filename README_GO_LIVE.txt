STACKOPS FINAL CLEAN LIVE BUILD

1) Upload this folder's files to your existing GitHub Pages repo after deleting old site files.
2) Keep CNAME only if you use a custom domain.
3) Run FULL_CLEAN_RESET_STACKOPS_SQL.sql once in Supabase SQL Editor.
4) Login with admin email:
   - kiratveersinghralhan@gmail.com
   - qq299629@gmail.com
5) Admin accounts automatically get Founder title, max XP, verified, approved seller, top leaderboard.

Manual UPI payment flow:
- Buyer clicks Buy Plan or Buy Service.
- QR and UPI ralhanx@ptaxis show.
- Buyer enters UTR/reference and uploads payment screenshot.
- Order appears in Admin > Payments.
- Admin approves/rejects.
- Approved plan unlocks premium XP.
- Approved service calculates seller earning and commission.

This build avoids Supabase Storage for proof uploads to prevent bucket/RLS issues. Screenshot proof is saved as text in manual_orders.proof_data.
