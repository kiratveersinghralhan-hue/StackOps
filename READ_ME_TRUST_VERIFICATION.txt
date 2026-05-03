SQL REQUIRED: YES
Run TRUST_VERIFICATION_AND_PROOF_SQL.sql in Supabase.

What changed:
- Verification rules changed to sensible trust requirements:
  profile completed, avatar uploaded, 3 posts, 5 helpful chats, 1 team created/joined, 24h account age, clean history.
- Seller/coach applications now require proof upload.
- Admin Seller Approval Desk now shows Account Details, proof document, activity counts, and verification readiness.
- Only one seller application per user.
- Founder/admin-only approve/reject remains.
