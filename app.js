(() => {
  const state = { loggedIn: false, authMode: "signin", supabase: null };
  const cfg = window.STACKOPS_CONFIG || {};
  const qs = (s, p = document) => p.querySelector(s);
  const qsa = (s, p = document) => Array.from(p.querySelectorAll(s));
  const toast = (m) => alert(m);

  function show(el) {
    if (!el) return;
    el.classList.remove("hidden");
    el.style.display = "";
  }

  function hide(el) {
    if (!el) return;
    el.classList.add("hidden");
    el.style.display = "none";
  }

  function initIntro() {
    const intro = qs("#introScreen");
    if (!intro) return;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      intro.classList.add("hide");
      setTimeout(() => intro.remove(), 1000);
    };

    window.addEventListener("load", () => setTimeout(finish, 1800), { once: true });
    setTimeout(finish, 4000);
  }

  function initSupabase() {
    try {
      if (
        window.supabase &&
        cfg.supabaseUrl &&
        cfg.supabaseAnonKey &&
        !String(cfg.supabaseUrl).includes("YOUR_") &&
        !String(cfg.supabaseAnonKey).includes("PASTE_")
      ) {
        state.supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: "pkce"
          }
        });
      }
    } catch (err) {
      console.error("Supabase init failed:", err);
    }
  }

  async function restoreOAuthSessionIfNeeded() {
    if (!state.supabase) return false;
    let touched = false;

    try {
      const url = new URL(window.location.href);
      const hasCode = !!url.searchParams.get("code");
      const hasHashToken = /access_token=/.test(window.location.hash || "");
      const hasError = !!url.searchParams.get("error_description");

      if (hasCode && state.supabase.auth.exchangeCodeForSession) {
        const { error } = await state.supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) console.error("OAuth exchange failed:", error);
        touched = true;
      }

      if (hasCode || hasHashToken || hasError) touched = true;

      if (touched) {
        window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      }
    } catch (err) {
      console.error("OAuth restore failed:", err);
    }

    return touched;
  }

  function setLoggedIn(flag, user = null) {
    state.loggedIn = flag;

    const guestHome = qs("#guestHome");
    const appShell = qs("#appShell");
    const guestActions = qs("#guestActions");
    const userActions = qs("#userActions");

    if (flag) {
      hide(guestHome);
      show(appShell);
      hide(guestActions);
      show(userActions);

      if (appShell) {
        appShell.classList.add("ready");
        appShell.style.opacity = "1";
        appShell.style.transform = "none";
        appShell.style.visibility = "visible";
      }

      const profileBtn = qs("#openProfileBtn");
      if (profileBtn && user?.email) profileBtn.textContent = user.email;

      closeAuth();
    } else {
      show(guestHome);
      hide(appShell);
      show(guestActions);
      hide(userActions);

      const profileBtn = qs("#openProfileBtn");
      if (profileBtn) profileBtn.textContent = "My Profile";
    }
  }

  async function syncSession() {
    if (!state.supabase) {
      setLoggedIn(false);
      return false;
    }

    try {
      const { data, error } = await state.supabase.auth.getSession();
      if (error) throw error;

      const user = data?.session?.user || null;
      if (user) {
        setLoggedIn(true, user);
        return true;
      }

      setLoggedIn(false);
      return false;
    } catch (err) {
      console.error("Session sync failed:", err);
      setLoggedIn(false);
      return false;
    }
  }

  function openAuth(mode = "signin") {
    state.authMode = mode;
    const title = qs("#authTitle");
    if (title) title.textContent = mode === "signup" ? "Create account" : "Sign in";
    show(qs("#authModal"));
  }

  function closeAuth() {
    hide(qs("#authModal"));
  }

  async function handleEmailAuth() {
    const email = qs("#authEmail")?.value?.trim();
    const password = qs("#authPassword")?.value || "";

    if (!state.supabase) return toast("Supabase is not configured yet. Add real values in config.js.");
    if (!email || !password) return toast("Enter email and password.");

    try {
      if (state.authMode === "signup") {
        const result = await state.supabase.auth.signUp({ email, password });

        if (result.error) {
          const msg = result.error.message || "";
          if (/already registered|already exists|user already registered/i.test(msg)) {
            const signin = await state.supabase.auth.signInWithPassword({ email, password });
            if (signin.error) throw signin.error;
            await syncSession();
            closeAuth();
            return;
          }
          throw result.error;
        }

        if (!result.data.session) {
          closeAuth();
          toast("Account created. Check email if confirmation is enabled.");
          return;
        }

        await syncSession();
        closeAuth();
        return;
      }

      const signin = await state.supabase.auth.signInWithPassword({ email, password });
      if (signin.error) throw signin.error;

      await syncSession();
      closeAuth();
    } catch (err) {
      console.error(err);
      toast(err.message || "Authentication failed.");
    }
  }

  async function handleGoogleAuth() {
    if (!cfg.googleEnabled) return toast("Enable Google provider in Supabase, then try again.");
    if (!state.supabase) return toast("Supabase is not configured yet. Add real values in config.js.");

    try {
      closeAuth();
      const { error } = await state.supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
    } catch (err) {
      console.error(err);
      toast(err.message || "Google login failed.");
    }
  }

  function bindAuthFlow() {
    qsa("[data-open-auth]").forEach(btn => {
      btn.addEventListener("click", () => openAuth(btn.dataset.openAuth));
    });

    const closeBtn = qs("#closeAuthModal");
    if (closeBtn) closeBtn.addEventListener("click", closeAuth);

    const submitBtn = qs("#submitAuthBtn");
    if (submitBtn) submitBtn.addEventListener("click", handleEmailAuth);

    const googleBtn = qs("#googleBtn");
    if (googleBtn) googleBtn.addEventListener("click", handleGoogleAuth);
  }

  function bindLogout() {
    const logoutBtn = qs("#logoutBtn");
    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        if (state.supabase) {
          const { error } = await state.supabase.auth.signOut();
          if (error) throw error;
        }
      } catch (err) {
        console.error("Logout failed:", err);
        toast(err.message || "Logout failed.");
      } finally {
        setLoggedIn(false);
        closeAuth();
        window.location.reload();
      }
    });
  }

  function bindSafeClicks() {
    const profileBtn = qs("#openProfileBtn");
    if (profileBtn) profileBtn.addEventListener("click", () => {});

    const notifBtn = qs("#openNotificationsBtn");
    if (notifBtn) notifBtn.addEventListener("click", () => toast("Notifications panel coming soon."));
  }

  async function init() {
    initIntro();
    closeAuth();
    initSupabase();
    bindAuthFlow();
    bindLogout();
    bindSafeClicks();

    const oauthTouched = await restoreOAuthSessionIfNeeded();
    let hasSession = await syncSession();

    if (!hasSession && oauthTouched) {
      await new Promise(r => setTimeout(r, 700));
      await syncSession();
    }

    if (state.supabase) {
      state.supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          setLoggedIn(true, session.user);
          closeAuth();
        } else {
          await syncSession();
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
