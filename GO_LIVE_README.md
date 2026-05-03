# StackOps / RiftForge — clean launch build

Original esports platform UI, inspired by premium tactical/glass interfaces. Not affiliated with Riot Games or Valorant.

## Setup
1. Upload all files to GitHub Pages / static hosting.
2. In Supabase SQL Editor run `FULL_CLEAN_RIFTFORGE_SUPABASE.sql` once.
3. Edit `config.js` and paste your Supabase URL + anon key.
4. Logout/login again after SQL.

## Admin emails
- kiratveersinghralhan@gmail.com
- qq299629@gmail.com

Admins get Founder identity, max XP, seller access, verified badge, and admin console.

## Payments
Manual UPI only:
- VPA: `ralhanx@ptaxis`
- QR: `upi.jpeg`
- User must upload screenshot + UTR/reference.
- Admin approves within 24–48 hours.

## Features included
- Login/signup with Supabase Auth
- Seller service creation ₹49–₹2999
- Manual UPI orders with proof upload
- Admin approval/reject flow
- Seller payout requests
- Squads/teams
- Chat rooms with realtime subscription
- Tactics planner
- Rewards, XP spend, XP history, daily XP once per day
- Leaderboard
- Proof carousel
- Optional Supabase Edge Function for OpenAI AI coach

## Important
Use a clean repo upload. Do not mix old broken files with this build.

## Flat ZIP note
This package has no subfolders. The optional Supabase Edge Function is included as `AI_COACH_EDGE_FUNCTION_index.ts`.
If you deploy the AI coach later, create a Supabase Edge Function named `ai-coach` and paste the contents of that file.
