# StackOps Manual Middleman Payment Workflow

## What this version does
StackOps works like a middleman marketplace:

1. Seller/coach applies to sell.
2. Admin approves seller.
3. Approved seller creates service listing.
4. Buyer books service and pays to your UPI/account first.
5. Buyer uploads payment screenshot/proof.
6. Admin opens Founder Control Room and checks Manual Payment Requests.
7. Admin approves/rejects payment proof.
8. Seller delivers service.
9. Admin pays seller manually after keeping commission.

## What to edit before live
Open `config.js` and set:

```js
MANUAL_UPI_ID: 'your-real-upi@bank',
MANUAL_UPI_QR_URL: 'optional-public-qr-image-url',
```

If you do not have QR URL yet, leave `MANUAL_UPI_QR_URL` empty. The UPI ID will still show.

## Suggested pricing and features

### Platform plans
- Free: ₹0 — profile, teams, posts, basic chat
- Bronze: ₹199 — profile boost + starter badge
- Silver: ₹499 — banner/title pack + higher visibility
- Gold: ₹999 — priority marketplace visibility
- Diamond: ₹2499 — premium identity + service boost
- Legend: ₹5999 — maximum premium identity

### Seller/coaching services
Sellers create their own listings after approval:
- VOD Review: ₹199–₹499
- 1 Hour Coaching: ₹299–₹999
- Team Scrim Review: ₹999–₹2499
- Bootcamp: ₹2499–₹5999

## Commission rules
The site calculates commission automatically:
- Under ₹500: 7%
- ₹500–₹999: 10%
- ₹1000–₹1999: 15%
- ₹2000–₹4999: 20–25%
- ₹5000+: 25%+

Example: Service price ₹500
- Buyer pays StackOps: ₹500
- StackOps commission 10%: ₹50
- Seller payout: ₹450

## Admin approval steps
1. Go to Admin / Founder Control Room.
2. Open Manual Payment Requests.
3. Click View Proof.
4. If screenshot/payment looks correct, click Approve.
5. After seller delivers service, click Mark Seller Paid.
6. If screenshot is fake/wrong, click Reject.

## Supabase SQL
Run `MIDDLEMAN_MARKETPLACE_SQL.sql` once.

## Storage bucket
SQL creates `payment-proofs` bucket automatically. If it already exists, it is ignored.

## Launch recommendation
Launch as Beta with manual payments first. Do not wait for Razorpay approval. Manual payment proof lets you start earning immediately.
