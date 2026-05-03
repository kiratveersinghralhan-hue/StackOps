# StackOps Manual UPI Middleman Payment Workflow

Razorpay rejected the online gaming category, so this version uses a manual UPI proof system.

## Your payment details

- UPI/VPA: `ralhanx@ptaxis`
- QR image: `upi-qr.jpeg`

## Buyer flow

1. Buyer chooses a seller service.
2. Buyer clicks **Book / Pay Proof**.
3. Buyer sees your UPI ID + QR code.
4. Buyer pays to your UPI.
5. Buyer uploads screenshot.
6. Buyer must enter UPI reference / UTR number.
7. Buyer submits proof.
8. Buyer sees message: approval can take **24–48 hours**.

## Admin flow

1. Open Admin panel.
2. Go to **Manual Payment Requests**.
3. Click **View Proof**.
4. Check screenshot and reference/UTR number.
5. Click **Approve Buyer Access** or **Reject**.
6. After service is complete, manually pay seller minus commission.
7. Click **Mark Seller Paid**.

## Commission flow

Money comes to you first.

Example:
- Service price: ₹500
- Commission: 10% = ₹50
- Seller payout: ₹450

## SQL

Run:

`FINAL_MANUAL_UPI_MIDDLEMAN_SQL.sql`

This creates:
- seller applications
- seller services
- manual orders
- proof storage bucket
- policies
- realtime

## Important

Payment approval is manual. Tell users clearly that payment will reflect after admin verification in 24–48 hours.
