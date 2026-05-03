# StackOps Seller Dashboard Workflow

## Seller side
1. User applies to sell.
2. Admin approves seller.
3. Seller opens **Seller Dashboard**.
4. Seller creates a service listing with title, game, price, and description.
5. Buyer orders that service from Marketplace.
6. Seller can track order status and earnings in Seller Dashboard.
7. Seller requests payout once orders are approved/completed.

## Buyer payment flow
1. Buyer clicks Buy on a service.
2. Manual UPI modal opens with QR + VPA `ralhanx@ptaxis`.
3. Buyer pays you directly.
4. Buyer uploads screenshot and enters UTR/reference number.
5. Buyer sees message that approval can take 24–48 hours.

## Admin side
1. Admin opens **Admin**.
2. Manual Payment Orders shows pending proofs.
3. Admin opens proof, checks UTR/payment in UPI/bank app.
4. Admin approves or rejects.
5. If approved, seller earning is tracked.
6. Seller payout requests appear in Admin.
7. After you pay seller manually, click **Mark Paid**.

## Commission
Commission is calculated from the configured `COMMISSION_RULES` in `config.js`.
The user pays StackOps first. Seller payout is tracked as `amount_inr - commission_inr`.
