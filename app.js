(() => {
  const state = {
    loggedIn: false,
    authMode: "signin",
    supabase: null
  };

  const cfg = window.STACKOPS_CONFIG || {};
  const qs = (s) => document.querySelector(s);

  function toast(msg) {
    alert(msg);
  }

  function initSupabase() {
    if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return;

    state.supabase = window.supabase.createClient(
      cfg.supabaseUrl,
      cfg.supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }

  async function restoreSession() {
    if (!state.supabase) return;

    // handle Google redirect
    if (window.location.hash.includes("access_token")) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const { data } = await state.supabase.auth.getSession();
    if (data?.session?.user) {
      setLoggedIn(true, data.session.user);
    } else {
      setLoggedIn(false);
    }
  }

  function setLoggedIn(flag, user = null) {
    state.loggedIn = flag;

    const guest = qs("#guestHome");
    const app = qs("#appShell");

    if (flag) {
      guest?.classList.add("hidden");
      app?.classList.remove("hidden");

      if (user?.email) {
        const btn = qs("#openProfileBtn");
        if (btn) btn.textContent = user.email;
      }
    } else {
      guest?.classList.remove("hidden");
      app?.classList.add("hidden");
    }
  }

  async function handleEmailAuth() {
    const email = qs("#authEmail")?.value.trim();
    const password = qs("#authPassword")?.value;

    if (!email || !password) {
      toast("Enter email and password.");
      return;
    }

    try {
      if (state.authMode === "signup") {
        const res = await state.supabase.auth.signUp({ email, password });

        if (res.error?.message?.includes("already")) {
          // fallback to login
          await state.supabase.auth.signInWithPassword({ email, password });
        }
      } else {
        const res = await state.supabase.auth.signInWithPassword({ email, password });
        if (res.error) throw res.error;
      }

      await restoreSession();
      closeAuth();
    } catch (err) {
      toast(err.message);
    }
  }

  async function handleGoogleAuth() {
    try {
      await state.supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin
        }
      });
    } catch (err) {
      toast("Google login failed");
    }
  }

  function closeAuth() {
    qs("#authModal")?.classList.add("hidden");
  }

  function openAuth(mode) {
    state.authMode = mode;
    qs("#authModal")?.classList.remove("hidden");
    qs("#authTitle").textContent = mode === "signup" ? "Create account" : "Sign in";
  }

  function bindAuth() {
    document.querySelectorAll("[data-open-auth]").forEach((btn) => {
      btn.onclick = () => openAuth(btn.dataset.openAuth);
    });

    qs("#submitAuthBtn")?.addEventListener("click", handleEmailAuth);
    qs("#googleBtn")?.addEventListener("click", handleGoogleAuth);
    qs("#closeAuthModal")?.addEventListener("click", closeAuth);
  }

  function bindLogout() {
    qs("#logoutBtn")?.addEventListener("click", async () => {
      await state.supabase.auth.signOut();
      setLoggedIn(false);
      window.location.reload();
    });
  }

  function initIntro() {
    const intro = qs("#introScreen");
    if (!intro) return;

    setTimeout(() => {
      intro.remove();
    }, 2000);
  }

  async function init() {
    initSupabase();
    bindAuth();
    bindLogout();
    initIntro();

    await restoreSession();

    if (state.supabase) {
      state.supabase.auth.onAuthStateChange(async () => {
        await restoreSession();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();