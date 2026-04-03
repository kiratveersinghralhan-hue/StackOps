(() => {
  const state = {
    loggedIn: false,
    authMode: "signin",
    supabase: null,
    reportTarget: null
  };

  const cfg = window.STACKOPS_CONFIG || {};
  const qs = (s, p = document) => p.querySelector(s);
  const qsa = (s, p = document) => Array.from(p.querySelectorAll(s));

  function show(el) { if (el) el.classList.remove("hidden"); }
  function hide(el) { if (el) el.classList.add("hidden"); }
  function toast(msg) { alert(msg); }

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
            detectSessionInUrl: true
          }
        });
      }
    } catch (err) {
      console.error("Supabase init failed:", err);
    }
  }

  async function restoreOAuthSessionIfNeeded() {
    if (!state.supabase) return;
    try {
      const url = new URL(window.location.href);
      const hasCode = !!url.searchParams.get("code");
      const hasAccessToken = /access_token=/.test(window.location.hash || "");

      if (hasCode && state.supabase.auth.exchangeCodeForSession) {
        const { error } = await state.supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) console.error("OAuth exchange failed:", error);
      }

      if (hasCode || hasAccessToken) {
        window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      }
    } catch (err) {
      console.error("OAuth restore failed:", err);
    }
  }

  async function syncSession() {
    if (!state.supabase) {
      setLoggedIn(false);
      return;
    }
    try {
      const { data, error } = await state.supabase.auth.getSession();
      if (error) throw error;
      const session = data?.session || null;
      if (session?.user) {
        setLoggedIn(true);
        const openProfileBtn = qs("#openProfileBtn");
        if (openProfileBtn && session.user.email) openProfileBtn.textContent = session.user.email;
        closeAuth();
      } else {
        setLoggedIn(false);
      }
    } catch (err) {
      console.error("Session sync failed:", err);
      setLoggedIn(false);
    }
  }

  function setLoggedIn(flag) {
    state.loggedIn = flag;
    const guestHome = qs("#guestHome");
    const appShell = qs("#appShell");
    const guestActions = qs("#guestActions");
    const userActions = qs("#userActions");

    if (flag) {
      hide(guestHome);
      show(appShell);
      if (appShell) appShell.classList.add("ready");
      hide(guestActions);
      show(userActions);
      closeAuth();
    } else {
      show(guestHome);
      hide(appShell);
      show(guestActions);
      hide(userActions);
      const openProfileBtn = qs("#openProfileBtn");
      if (openProfileBtn) openProfileBtn.textContent = "My Profile";
    }
  }

  function openAuth(mode = "signin") {
    state.authMode = mode;
    const authTitle = qs("#authTitle");
    if (authTitle) authTitle.textContent = mode === "signup" ? "Create account" : "Sign in";
    show(qs("#authModal"));
  }
  function closeAuth() { hide(qs("#authModal")); }

  function openReport(target = null) { state.reportTarget = target; show(qs("#reportModal")); }
  function closeReport() { hide(qs("#reportModal")); }

  function openDetail(type, name, meta) {
    const typeEl = qs("#detailType");
    const nameEl = qs("#detailName");
    const metaEl = qs("#detailMeta");
    if (typeEl) typeEl.textContent = `${String(type || "detail").toUpperCase()} VIEW`;
    if (nameEl) nameEl.textContent = name || "Item";
    if (metaEl) metaEl.textContent = meta || "";
    show(qs("#detailModal"));
  }
  function closeDetail() { hide(qs("#detailModal")); }

  function switchView(viewName) {
    qsa(".rail-item").forEach((b) => b.classList.toggle("active", b.dataset.view === viewName));
    qsa(".view").forEach((v) => v.classList.remove("active"));
    const panel = qs(`#view-${viewName}`);
    if (panel) panel.classList.add("active");
    const title = qs("#viewTitle");
    const activeBtn = qsa(".rail-item").find((b) => b.dataset.view === viewName);
    if (title && activeBtn) title.textContent = activeBtn.textContent.trim();
  }

  function bindNav() {
    qsa(".rail-item").forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));
  }

  function bindDetails() {
    qsa(".entity-card.clickable").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".team-report-btn")) return;
        openDetail(card.dataset.detailType, card.dataset.name, card.dataset.meta);
      });
    });
  }

  function bindReportFlow() {
    const openBtn = qs("#openReportBtn");
    const closeBtn = qs("#closeReportModal");
    const cancelBtn = qs("#cancelReportBtn");
    const submitBtn = qs("#submitReportBtn");

    if (openBtn) openBtn.addEventListener("click", () => openReport({ type: "general", id: "manual" }));
    if (closeBtn) closeBtn.addEventListener("click", closeReport);
    if (cancelBtn) cancelBtn.addEventListener("click", closeReport);
    if (submitBtn) submitBtn.addEventListener("click", async () => {
      const body = qs("#reportBody")?.value?.trim() || "";
      const payload = { target: state.reportTarget, details: body, createdAt: new Date().toISOString() };

      if (state.supabase) {
        try {
          const { error } = await state.supabase.from("reports").insert({
            target_type: payload.target?.type || "unknown",
            target_id: payload.target?.id || null,
            reason: body || "manual report",
            details: JSON.stringify(payload)
          });
          if (error) throw error;
          closeReport();
          return toast("Report submitted.");
        } catch (err) {
          console.error("Remote report failed, fallback local:", err);
        }
      }
      const existing = JSON.parse(localStorage.getItem("stackops_reports") || "[]");
      existing.push(payload);
      localStorage.setItem("stackops_reports", JSON.stringify(existing));
      closeReport();
      toast("Report saved locally.");
    });

    qsa(".tag").forEach(tag => tag.addEventListener("click", () => {
      const body = qs("#reportBody");
      if (body && !body.value.trim()) body.value = tag.textContent.trim();
    }));

    qsa(".team-report-btn").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openReport({ type: "team", id: "team-card" });
      })
    );
  }

  function bindDetailModal() {
    const closeA = qs("#closeDetailModal");
    const closeB = qs("#closeDetailBtn");
    if (closeA) closeA.addEventListener("click", closeDetail);
    if (closeB) closeB.addEventListener("click", closeDetail);
  }

  function bindAvatarUpload() {
    const input = qs("#avatarInput");
    const preview = qs("#avatarPreview");
    const genBtn = qs("#generateAvatarBtn");

    if (input && preview) {
      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => { preview.src = e.target.result; };
        reader.readAsDataURL(file);
      });
    }

    if (genBtn && preview) {
      genBtn.addEventListener("click", () => {
        const colors = ["#8fe8ff", "#f0d56f", "#7fd1ff", "#9effc2"];
        const c = colors[Math.floor(Math.random() * colors.length)];
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><rect width='100%' height='100%' rx='42' fill='#081326'/><circle cx='128' cy='96' r='42' fill='${c}'/><rect x='58' y='154' width='140' height='56' rx='28' fill='${c}' opacity='.9'/></svg>`;
        preview.src = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
      });
    }
  }

  async function handleEmailAuth() {
    const email = qs("#authEmail")?.value?.trim();
    const password = qs("#authPassword")?.value || "";

    if (!state.supabase) return toast("Supabase is not configured yet. Add real values in config.js.");
    if (!email || !password) return toast("Enter email and password.");

    try {
      let result;

      if (state.authMode === "signup") {
        result = await state.supabase.auth.signUp({ email, password });

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
          return toast("Account created. Check email if confirmation is enabled.");
        }
      } else {
        result = await state.supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
      }

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
      const { error } = await state.supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
    } catch (err) {
      console.error(err);
      toast(err.message || "Google sign-in failed.");
    }
  }

  function bindQuickActions() {
    const wire = (selector, view, title, meta) => {
      const btn = qs(selector);
      if (btn) btn.addEventListener("click", () => {
        if (view) switchView(view);
        if (title) openDetail("action", title, meta || "");
      });
    };
    wire("#createTeamQuickBtn", "teams", "Create team", "Team creation backend hook can be connected here.");
    wire("#createTeamBtn", "teams", "Create team", "Team creation backend hook can be connected here.");
    wire("#createPostBtn", "posts", "Create post", "Post composer backend hook can be connected here.");
    wire("#createTournamentBtn", "tournaments", "Create tournament", "Tournament creation backend hook can be connected here.");
    wire("#newPostQuickBtn", "posts", null, null);
    wire("#joinTournamentQuickBtn", "tournaments", null, null);
  }

  function bindAuthFlow() {
    qsa("[data-open-auth]").forEach((btn) => btn.addEventListener("click", () => openAuth(btn.dataset.openAuth)));
    const closeBtn = qs("#closeAuthModal");
    if (closeBtn) closeBtn.addEventListener("click", closeAuth);
    const submit = qs("#submitAuthBtn");
    if (submit) submit.addEventListener("click", handleEmailAuth);
    const googleBtn = qs("#googleBtn");
    if (googleBtn) googleBtn.addEventListener("click", handleGoogleAuth);
    const notifications = qs("#openNotificationsBtn");
    if (notifications) notifications.addEventListener("click", () => toast("Notifications panel coming soon."));
    const profileBtn = qs("#openProfileBtn");
    if (profileBtn) profileBtn.addEventListener("click", () => switchView("settings"));
  }

  function bindLogout() {
    const btn = qs("#logoutBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      try {
        if (state.supabase) {
          const { error } = await state.supabase.auth.signOut({ scope: "local" });
          if (error) throw error;
        }
      } catch (err) {
        console.error(err);
        toast(err.message || "Logout failed.");
      } finally {
        setLoggedIn(false);
        closeAuth();
        window.location.href = window.location.origin;
      }
    });
  }

  function initIntro() {
    const intro = qs("#introScreen");
    if (!intro) return;
    let finished = false;
    const hideIntro = () => {
      if (finished) return;
      finished = true;
      intro.classList.add("hide");
      setTimeout(() => { if (intro.parentNode) intro.parentNode.removeChild(intro); }, 1200);
    };
    window.addEventListener("load", () => setTimeout(hideIntro, 2100), { once: true });
    setTimeout(hideIntro, 4200);
  }

  async function init() {
    closeAuth();
    initSupabase();
    bindAuthFlow();
    bindNav();
    bindDetails();
    bindReportFlow();
    bindDetailModal();
    bindAvatarUpload();
    bindQuickActions();
    bindLogout();
    initIntro();

    await restoreOAuthSessionIfNeeded();
    await syncSession();

    if (state.supabase) {
      state.supabase.auth.onAuthStateChange(async (event) => {
        if (event === "SIGNED_OUT") {
          setLoggedIn(false);
          closeAuth();
          return;
        }
        await syncSession();
        closeAuth();
      });
    }
  }

  async function restoreOAuthSessionIfNeeded() {
    if (!state.supabase) return;
    try {
      const url = new URL(window.location.href);
      const hasCode = !!url.searchParams.get("code");
      const hasAccessToken = /access_token=/.test(window.location.hash || "");

      if (hasCode && state.supabase.auth.exchangeCodeForSession) {
        const { error } = await state.supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) console.error("OAuth exchange failed:", error);
      }

      if (hasCode || hasAccessToken) {
        window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      }
    } catch (err) {
      console.error("OAuth restore failed:", err);
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();