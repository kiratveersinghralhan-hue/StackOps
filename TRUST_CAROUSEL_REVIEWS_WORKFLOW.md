StackOps Trust Carousel + Reviews Workflow

1. Run TRUST_CAROUSEL_REVIEWS_SQL.sql in Supabase.
2. Users buy plans/services with manual UPI checkout.
3. User enters UTR/reference number and uploads screenshot proof.
4. Admin approves/rejects the manual order in admin panel.
5. To show a payment in the home page trust carousel, set manual_orders.is_feedback_public = true for approved orders.
6. Users can leave seller/service reviews from Marketplace > Seller Reviews > Leave Review.
7. Reviews appear publicly only after admin approval.

Important: only show payment proof screenshots publicly when the buyer allowed it and private bank details are safe.
