# StackOps Arena Pro Final

SQL REQUIRED: YES

## What this version includes
- Riot/Valorant-inspired esports-business UI
- Dark + light mixed theme toggle
- Guest view + login/signup
- Language selection popup with worldwide languages
- Live counters and live activity ticker
- Segregated pages: Lobby, Squads, Feed, Marketplace, Chat, Plans, Admin
- Admin by email, not UID
- Admin emails: kiratveersinghralhan@gmail.com, qq299629@gmail.com
- Crown / 1-of-1 founder identity in backend and UI
- Auto-approved users
- Admin-approved sellers only
- Plans: ₹0, ₹199, ₹499, ₹999, ₹2499, ₹5999
- Commission rules: 7%, 10%, 15%, 20%, 25%, 30%
- Razorpay test mode frontend checkout
- Supabase realtime messages table for chat channels
- Storage buckets: avatars, banners, post-images, service-proof, chat-files

## Setup
1. Open Supabase SQL editor.
2. Run `database-clean-reset-full.sql`.
3. In Supabase dashboard, enable Realtime for `public.messages`.
4. Edit `config.js`:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - RAZORPAY_KEY_ID test key
5. Open `index.html` or deploy the folder.

## Razorpay note
This frontend creates test checkout popups. For real production payments, add a secure server/edge function to create Razorpay orders and verify payment signatures. Never put Razorpay secret keys in frontend code.

## Going live costs before launch
Minimum testing: domain + Supabase + hosting can start low. Real launch with chat, storage and traffic needs paid Supabase/hosting and payment gateway compliance.

## Folder rule
This ZIP has one main folder only and no subfolders.
