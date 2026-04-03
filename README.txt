StackOps auth fix patch

Changed:
1. Added id="authEmail" and id="authPassword" to the auth modal inputs so app.js can read them.
2. Removed leading whitespace from supabaseAnonKey in config.js.

Replace your current files with these patched versions:
- index.html
- config.js

app.js is included unchanged for convenience.
