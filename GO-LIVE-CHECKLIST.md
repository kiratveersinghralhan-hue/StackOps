# StackOps Go-Live Checklist

## 1. Supabase
Run `live-ready-final-migration.sql` once in Supabase SQL Editor.

## 2. Config
Open `config.js` and replace:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `RAZORPAY_KEY_ID`

Your admin emails are already set:
- kiratveersinghralhan@gmail.com
- qq299629@gmail.com

## 3. Razorpay
Start with test mode key: `rzp_test_...`.
When ready, replace with live key: `rzp_live_...`.

Important: for real money production, verify payments on a secure backend/serverless function before giving paid benefits.
The current frontend opens Razorpay and records the payment response in Supabase.

## 4. Deploy
You can deploy the folder to GitHub Pages, Netlify, Vercel, or any static hosting.

## 5. Ads/Launch Flow
Best flow while advertising in-game:
1. Guest lands on Lobby.
2. They click Find Squad or Customize Identity.
3. Login modal appears.
4. User signs up.
5. They get Rookie title + Starter Arena Card by default.
6. They earn XP from quests to unlock banners/titles/badges.
