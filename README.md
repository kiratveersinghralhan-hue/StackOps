# StackOps Final Product

SQL REQUIRED: NO, if your backend is already set up from the previous StackOps SQL.

Optional SQL is included in `optional-sql-missing-features.sql` only if you are missing feature tables such as teams, posts, messages, seller_applications, payments, notifications, or storage buckets.

## Setup
1. Open `config.js`.
2. Add your Supabase URL and anon key.
3. Add Razorpay test key if you want checkout popups.
4. Deploy all files in this one folder.

## Admin Emails
Configured in `config.js` and SQL:
- kiratveersinghralhan@gmail.com
- qq299629@gmail.com

Admins get Founder identity, Founder banner, crown, and admin console access.

## Features
- Full-screen game lobby homepage
- My Account/profile editor
- Avatar and banner uploads
- Valorant-style banner collection
- Collectible titles, badges, rewards
- Team create/delete/join UI
- Community posts with image upload
- Direct + group chat UI
- Voice room UI preview
- Marketplace with commission rules
- Seller application flow
- Admin console
- Scroll-to-top button
- Dark/light mixed theme
- Mobile responsive layout

## Important
Voice chat is a UI layer in this package. Real voice needs a service such as LiveKit, Agora, Daily, or WebRTC signaling backend.
