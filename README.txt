STACKOPS — Final checked one-folder patch

What was fixed:
1. index.html had the scripts in the wrong order and app.js was loaded twice.
   Correct order is now:
   - Supabase CDN
   - config.js
   - app.js

2. index.html report modal was missing:
   - id="reportBody"
   - id="submitReportBtn"
   app.js already expects these IDs.

3. app.js OAuth restore was hardened to handle return URLs more safely.

4. intro animation was kept smooth and made safer with a single-finish guard.

Replace these files in repo root:
- index.html
- app.js
- config.js
- styles.css
- README.txt
