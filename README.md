# StackOps Live Ready Final

A Riot/Valorant-style gamer social lobby with guest view, login/signup, account customization, teams, community posts, realtime chat UI, voice room UI, marketplace, rewards, badges, titles, banners, and founder/admin controls.

## SQL REQUIRED: YES
Run `live-ready-final-migration.sql` once in Supabase SQL Editor.

This migration is safe to run multiple times and does not delete your data.

## Admin Emails
Founder/admin access is controlled by email:
- kiratveersinghralhan@gmail.com
- qq299629@gmail.com

Admins automatically unlock:
- Founder title
- Origin Crown badge
- Founder Crownline banner
- Admin console
- Crown identity UI

Regular users start with:
- Rookie title
- Starter Spark badge
- Starter Arena Card banner

Founder/admin rewards are locked for everyone else.

## Razorpay
Edit `config.js`:
```js
RAZORPAY_KEY_ID: 'rzp_test_YOUR_KEY_ID'
```
Use test mode first. Switch to `rzp_live_...` only when ready.

For real production money, add server-side payment verification later.

## Files
- `index.html` — main app
- `styles.css` — responsive UI + animations
- `app.js` — frontend logic
- `config.js` — Supabase/Razorpay/admin config
- `live-ready-final-migration.sql` — backend migration
- `GO-LIVE-CHECKLIST.md` — launch steps

## Deploy
Upload the full folder to any static host.
