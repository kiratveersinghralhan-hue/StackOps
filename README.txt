StackOps patched build

This patch fixes the stuck intro by making it independent from auth/config loading.
Default config keeps Supabase off so the site opens to guest homepage first.

When ready for Supabase:
1. Put real values in config.js
2. Set googleEnabled = true
