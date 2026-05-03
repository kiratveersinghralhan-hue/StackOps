# StackOps Next Upgrade Workflow

## User/buyer payment flow
1. Buyer chooses a plan or seller service.
2. Manual UPI modal opens with QR and UPI ID: `ralhanx@ptaxis`.
3. Buyer pays you first.
4. Buyer enters UPI reference/UTR and uploads a clear screenshot.
5. Order status becomes `pending`.
6. Message shown: payment reflects within 24–48 hours after admin verification.

## Admin approval flow
1. Open Founder/Admin panel.
2. Check Manual Payment Requests.
3. Click View Proof and compare screenshot with your UPI/bank app.
4. Approve = buyer access activates and seller payout is added.
5. Reject = user is asked to upload clearer proof.
6. Mark Seller Paid = after you manually pay seller, payout is marked paid.

## Seller wallet
- Sellers see approved orders and payout amount.
- Pending payout = amount you still owe seller after your commission.
- Paid out = amount you already marked as paid.

## Commission
Commission is calculated from `COMMISSION_RULES` in `config.js`.
