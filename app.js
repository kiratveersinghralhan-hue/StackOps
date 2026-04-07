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

  function show(el) {
    if (el) el.classList.remove("hidden");
  }

  function hide(el) {
    if (el) el.classList.add("hidden");
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
        state.supabase = window.supabase.createClient(
          cfg.supabaseUrl,
          cfg.supabaseAnonKey
        );
      }
    } catch (err) {
      console.error("Supabase init failed:", err);
    }
  }

  async function syncSession() {
    if (!state.supabase) {
      setLoggedIn(false);
      return;
    }

    try {
      const {
        data: { session },
        error
      } = await state.supabase.auth.getSession();

      if (error) throw error;

      if (session?.user) {
        setLoggedIn(true);

        const openProfileBtn = qs("#openProfileBtn");
        if (session.user.email && openProfileBtn) {
          openProfileBtn.textContent = session.user.email;
        }

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
    } else {
      show(guestHome);
      hide(appShell);
      show(guestActions);
      hide(userActions);
    }
  }

  function openAuth(mode = "signin") {
    state.authMode = mode;
    const authTitle = qs("#authTitle");
    if (authTitle) {
      authTitle.textContent = mode === "signup" ? "Create account" : "Sign in";
    }
    show(qs("#authModal"));
  }

  function closeAuth() {
    hide(qs("#authModal"));
  }

  function openReport(target = null) {
    state.reportTarget = target;
    show(qs("#reportModal"));
  }

  function closeReport() {
    hide(qs("#reportModal"));
  }

  function openDetail(type, name, meta) {
    const detail = qs("#detailModal");
    const typeEl = qs("#detailType");
    const nameEl = qs("#detailName");
    const metaEl = qs("#detailMeta");

    if (typeEl) typeEl.textContent = `${String(type || "detail").toUpperCase()} VIEW`;
    if (nameEl) nameEl.textContent = name || "Item";
    if (metaEl) metaEl.textContent = meta || "";

    show(detail);
  }

  function closeDetail() {
    hide(qs("#detailModal"));
  }

  function bindNav() {
    qsa(".rail-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        qsa(".rail-item").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const view = btn.dataset.view;
        qsa(".view").forEach((v) => v.classList.remove("active"));

        const panel = qs(`#view-${view}`);
        if (panel) panel.classList.add("active");

        const title = qs("#viewTitle");
        if (title) title.textContent = btn.textContent.trim();
      });
    });
  }

  function bindDetails() {
    qsa(".entity-card.clickable").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".team-report-btn")) return;
        openDetail(card.dataset.detailType, card.dataset.name, card.dataset.meta);
      });
    });

    qsa(".detail-trigger").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openDetail(btn.dataset.type, btn.dataset.title, btn.dataset.meta);
      });
    });
  }

  function bindTeamReportButtons() {
    qsa(".team-report-btn").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openReport({ type: "team", id: "team-card" });
      })
    );

    qsa(".report-trigger").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openReport({
          type: btn.dataset.targetType || "unknown",
          id: btn.dataset.targetId || ""
        });
      })
    );
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
        reader.onload = (e) => {
          preview.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    if (genBtn && preview) {
      genBtn.addEventListener("click", () => {
        const colors = ["#8fe8ff", "#f0d56f", "#7fd1ff", "#9effc2"];
        const c = colors[Math.floor(Math.random() * colors.length)];
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><rect width='100%' height='100%' rx='42' fill='#081326'/><circle cx='128' cy='96' r='42' fill='${c}'/><rect x='58' y='154' width='140' height='56' rx='28' fill='${c}' opacity='.9'/></svg>`;
        preview.src =
          "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
      });
    }
  }

  async function handleEmailAuth() {
    const email = qs("#authEmail")?.value?.trim();
const password = qs("#authPassword")?.value || "";

if (!email || !password) {
  alert("Enter email and password.");
  return;
}

    try {
      let result;

      if (state.authMode === "signup") {
        result = await state.supabase.auth.signUp({ email, password });
      } else {
        result = await state.supabase.auth.signInWithPassword({ email, password });
      }

      if (result.error) throw result.error;

      await syncSession();
      closeAuth();

      if (state.authMode === "signup" && !result.data.session) {
        alert("Account created. Check email if confirmation is enabled.");
      }
    } catch (err) {
      alert(err.message || "Authentication failed.");
      console.error(err);
    }
  }

  async function handleGoogleAuth() {
    if (!cfg.googleEnabled) {
      alert("Enable Google provider in Supabase, then try again.");
      return;
    }

    if (!state.supabase) {
      alert("Supabase is not configured yet. Add real values in config.js.");
      return;
    }

    try {
      const { error } = await state.supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin }
      });

      if (error) throw error;
    } catch (err) {
      alert(err.message || "Google sign-in failed.");
      console.error(err);
    }
  }

  function bindAuthFlow() {
    qsa("[data-open-auth]").forEach((btn) =>
      btn.addEventListener("click", () => openAuth(btn.dataset.openAuth))
    );

    const closeBtn = qs("#closeAuthModal");
    if (closeBtn) closeBtn.addEventListener("click", closeAuth);

    const submit = qs("#submitAuthBtn");
    if (submit) submit.addEventListener("click", handleEmailAuth);

    const googleBtn = qs("#googleBtn");
    if (googleBtn) googleBtn.addEventListener("click", handleGoogleAuth);

    const riotBtn = qs("#riotBtn");
    if (riotBtn) {
      riotBtn.addEventListener("click", () => {
        alert(
          "Riot sign-in needs Riot OAuth approval and backend credentials. Keep this as coming soon until configured."
        );
      });
    }
  }

  async function submitReport() {
    const body = qs("#reportBody")?.value?.trim() || "";
    const payload = {
      target: state.reportTarget,
      details: body,
      createdAt: new Date().toISOString()
    };

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
        alert("Report submitted.");
        return;
      } catch (err) {
        console.error("Remote report failed, falling back to local storage:", err);
      }
    }

    const existing = JSON.parse(localStorage.getItem("stackops_reports") || "[]");
    existing.push(payload);
    localStorage.setItem("stackops_reports", JSON.stringify(existing));
    closeReport();
    alert("Report saved locally.");
  }

  function bindReportFlow() {
    const closeBtn = qs("#closeReportModal");
    const cancelBtn = qs("#cancelReportBtn");
    const openBtn = qs("#openReportBtn");
    const submitBtn = qs("#submitReportBtn");

    if (openBtn) {
      openBtn.addEventListener("click", () =>
        openReport({ type: "general", id: "manual" })
      );
    }

    if (closeBtn) closeBtn.addEventListener("click", closeReport);
    if (cancelBtn) cancelBtn.addEventListener("click", closeReport);
    if (submitBtn) submitBtn.addEventListener("click", submitReport);
  }

  function bindDetailModal() {
    const closeA = qs("#closeDetailModal");
    const closeB = qs("#closeDetailBtn");

    if (closeA) closeA.addEventListener("click", closeDetail);
    if (closeB) closeB.addEventListener("click", closeDetail);
  }

  function bindLogout() {
    const btn = qs("#logoutBtn");
    if (btn) {
      btn.addEventListener("click", async () => {
        if (state.supabase) {
          try {
            await state.supabase.auth.signOut();
          } catch (err) {
            console.error(err);
          }
        }
        setLoggedIn(false);
      });
    }
  }

  function initIntro() {
    const intro = qs("#introScreen");
    if (!intro) return;

    const hideIntro = () => {
      intro.classList.add("hide");
      setTimeout(() => {
        if (intro.parentNode) intro.parentNode.removeChild(intro);
      }, 1200);
    };

    document.addEventListener(
      "DOMContentLoaded",
      () => setTimeout(hideIntro, 1800),
      { once: true }
    );
    window.addEventListener("load", () => setTimeout(hideIntro, 2200), {
      once: true
    });
    setTimeout(hideIntro, 4500);
  }

  async function init() {
    initSupabase();
    bindAuthFlow();
    bindNav();
    bindDetails();
    bindTeamReportButtons();
    bindAvatarUpload();
    bindReportFlow();
    bindDetailModal();
    bindLogout();
    initIntro();

    if (state.supabase) {
      try {
        const {
          data: { session }
        } = await state.supabase.auth.getSession();

        if (session?.user) {
          setLoggedIn(true);
          const openProfileBtn = qs("#openProfileBtn");
          if (session.user.email && openProfileBtn) {
            openProfileBtn.textContent = session.user.email;
          }
          closeAuth();
        }
      } catch (err) {
        console.error("Initial session restore failed:", err);
      }
    }

    await syncSession();

    if (state.supabase) {
      state.supabase.auth.onAuthStateChange(async () => {
        await syncSession();
        closeAuth();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
