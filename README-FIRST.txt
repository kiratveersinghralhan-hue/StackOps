STACKOPS FUNLOBBY PRO

SQL REQUIRED: YES
Why: this version changes backend admin logic to email-based admin and includes the full production schema for profiles, squads, invites, services, payments, badges, posts, chat rooms, messages, events, and storage buckets.

IMPORTANT SETUP:
1. Open database-clean-reset-full.sql.
2. Replace YOUR_ADMIN_EMAIL@example.com with your real admin email.
3. Run the full SQL in Supabase SQL Editor.
4. Open config.js and add:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - ADMIN_EMAILS: ['yourrealemail@gmail.com']
5. Upload/deploy this folder.
6. Login with that admin email.

Admin is now by EMAIL, not UID.

One folder only, no subfolders.

What changed:
- More fun gamer lobby UI/UX
- Smooth intro animation
- Live counters
- Minimal futuristic cards
- Admin crown identity
- Admin console: approve/ban/verify users, approve/reject services, verify/reject payments
- Plans up to Rs 10,000
- Services/coaching marketplace with commission tracking
- Squad finder and invite requests
- Feed posting
- Badges/titles/rewards
- Supabase storage buckets: avatars, banners, posts, service-files, clips

Performance notes:
- No heavy particles library.
- No huge animation framework.
- Uses CSS animations and lightweight vanilla JavaScript.
