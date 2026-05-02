// StackOps config. Supabase anon keys are public by design, but use Row Level Security in Supabase.
window.STACKOPS_CONFIG = {
  appName: "StackOps",
  supabaseUrl: "https://ffagzruaerzftqwmnbmp.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmYWd6cnVhZXJ6ZnRxd21uYm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTYyMTcsImV4cCI6MjA5MDczMjIxN30.H_bI5O0YLMOjvnyGyi6HIq1scBHydRebB3lx7nJkVzc",
  tables: {
    profiles: "profiles",
    squads: "squads",
    posts: "posts",
    events: "events",
    invites: "invites"
  },
  demoModeWhenSupabaseFails: true
};
