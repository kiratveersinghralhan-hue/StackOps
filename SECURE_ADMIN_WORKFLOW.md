# StackOps Secure Admin System

## Run SQL
Run `SECURE_ADMIN_MANUAL_PAYMENTS_SQL.sql` in Supabase SQL Editor.
Choose **Run and enable RLS** if Supabase asks.

## Payment flow
1. Buyer pays to your UPI QR/VPA.
2. Buyer enters UTR/reference number and uploads screenshot.
3. Admin sees the request in **Admin → Manual Payment Requests**.
4. Admin opens proof, verifies UPI/payment manually, then clicks **Approve** or **Reject**.
5. Approved plan payments unlock the plan. Approved seller service orders add seller payout amount.
6. After paying seller manually, click **Mark Seller Paid**.

## Intro/loading screen
The intro has an emergency timeout, so it will not stay stuck even if a network/API call fails.
