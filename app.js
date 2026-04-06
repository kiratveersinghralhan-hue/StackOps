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
  const toast = (msg) => alert(msg);

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

  function initIntro() {
    const intro = qs("#introScreen");
    if (!intro) return;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      intro.classList.add("hide");
      setTimeout(() => {
        if (intro.parentNode) intro.parentNode.removeChild(intro);
      }, 900);
    };

    window.addEventListener("load", () => setTimeout(finish, 1600), { once: true });
    setTimeout(finish, 3500);
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
      const hasErr = !!url.searchParams.get("error_description");

      if (hasCode && state.supabase.auth.exchangeCodeForSession) {
        const { error } = await state.supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) console.error("OAuth exchange failed:", error);
        touched = true;
      }

      if (hasCode || hasHashToken || hasErr) touched = true;

      if (touched) {
        window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      }
    } catch (err) {
      console.error("OAuth restore failed:", err);
    }

    return touched;
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

  function openDetail(type, name, meta) {
    const typeEl = qs("#detailType");
    const nameEl = qs("#detailName");
    const metaEl = qs("#detailMeta");

    if (typeEl) typeEl.textContent = `${String(type || "detail").toUpperCase()} VIEW`;
    if (nameEl) nameEl.textContent = name || "Item";
    if (metaEl) metaEl.textContent = meta || "";

    show(qs("#detailModal"));
  }

  function closeDetail() {
    hide(qs("#detailModal"));
  }

  function openReport(target = null) {
    state.reportTarget = target;
    show(qs("#reportModal"));
  }

  function closeReport() {
    hide(qs("#reportModal"));
  }

  function switchView(viewName) {
    qsa(".rail-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === viewName));
    qsa(".view").forEach((view) => view.classList.remove("active"));

    const panel = qs(`#view-${viewName}`);
    if (panel) panel.classList.add("active");

    const title = qs("#viewTitle");
    const activeBtn = qsa(".rail-item").find((btn) => btn.dataset.view === viewName);
    if (title && activeBtn) title.textContent = activeBtn.textContent.trim();
  }

  async function fallbackSignin(email, password) {
    const signin = await state.supabase.auth.signInWithPassword({ email, password });
    if (signin.error) throw signin.error;
    await syncSession();
    closeAuth();
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
            await fallbackSignin(email, password);
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

  async function submitReport() {
    const body = qs("#reportBody")?.value?.trim() || "";
    const payload = {
      target: state.reportTarget,
      details: body,
      createdAt: new Date().toISOString()
    };

    if (state.supabase) {
      try {
        const { data: sessionData } = await state.supabase.auth.getSession();
        const reporter = sessionData?.session?.user || null;

        const { error } = await state.supabase.from("reports").insert({
          reporter_id: reporter?.id || null,
          target_type: payload.target?.type || "unknown",
          target_id: payload.target?.id || null,
          reason: body || "manual report",
          details: JSON.stringify(payload)
        });
        if (error) throw error;
        closeReport();
        toast("Report submitted.");
        return;
      } catch (err) {
        console.error("Remote report failed, fallback local:", err);
      }
    }

    const existing = JSON.parse(localStorage.getItem("stackops_reports") || "[]");
    existing.push(payload);
    localStorage.setItem("stackops_reports", JSON.stringify(existing));
    closeReport();
    toast("Report saved locally.");
  }

  function openTeamModal() {
    show(qs("#teamModal"));
  }

  function closeTeamModal() {
    hide(qs("#teamModal"));
  }

  function renderTeamCard(team) {
    return `
      <article class="entity-card clickable"
        data-detail-type="team"
        data-name="${team.name || "Team"}"
        data-meta="${team.status || "Recruiting"} • ${team.region || "Unknown region"} • ${team.rank_target || "Any rank"}">
        <div>
          <h4>${team.name || "Unnamed Team"}</h4>
          <p>${team.description || "No description yet."}</p>
        </div>
        <button class="btn ghost small team-report-btn">Report</button>
      </article>
    `;
  }

  async function loadTeams() {
    const teamsList = qs("#teamsList");
    if (!teamsList || !state.supabase) return;

    try {
      const { data, error } = await state.supabase
        .from("teams")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || !data.length) {
        teamsList.innerHTML = `<div class="panel">No teams yet.</div>`;
        return;
      }

      teamsList.innerHTML = data.map(renderTeamCard).join("");
      bindDetails();
      bindReportFlow();
    } catch (err) {
      console.error("Load teams failed:", err);
    }
  }

  async function handleCreateTeam() {
    if (!state.supabase) return toast("Supabase is not configured yet.");

    const name = qs("#teamName")?.value?.trim();
    const description = qs("#teamDescription")?.value?.trim() || "";
    const region = qs("#teamRegion")?.value?.trim() || "";
    const rankTarget = qs("#teamRankTarget")?.value?.trim() || "";

    if (!name) return toast("Enter team name.");

    try {
      const { data: sessionData, error: sessionError } = await state.supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const user = sessionData?.session?.user;
      if (!user) return toast("Please log in first.");

      const { error } = await state.supabase
        .from("teams")
        .insert({
          created_by: user.id,
          name,
          description,
          region,
          rank_target: rankTarget,
          status: "Recruiting"
        });

      if (error) throw error;

      qs("#teamName").value = "";
      qs("#teamDescription").value = "";
      qs("#teamRegion").value = "";
      qs("#teamRankTarget").value = "";

      closeTeamModal();
      await loadTeams();
      switchView("teams");
      toast("Team created.");
    } catch (err) {
      console.error("Create team failed:", err);
      toast(err.message || "Could not create team.");
    }
  }

  function bindAuthFlow() {
    qsa("[data-open-auth]").forEach((btn) => {
      btn.addEventListener("click", () => openAuth(btn.dataset.openAuth));
    });

    const closeBtn = qs("#closeAuthModal");
    if (closeBtn) closeBtn.addEventListener("click", closeAuth);

    const submitBtn = qs("#submitAuthBtn");
    if (submitBtn) submitBtn.addEventListener("click", handleEmailAuth);

    const googleBtn = qs("#googleBtn");
    if (googleBtn) googleBtn.addEventListener("click", handleGoogleAuth);

    const riotBtn = qs("#riotBtn");
    if (riotBtn) riotBtn.addEventListener("click", () => toast("Riot sign-in is coming soon."));
  }

  function bindNav() {
    qsa(".rail-item").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.view));
    });
  }

  function bindDetails() {
    qsa(".entity-card.clickable").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".team-report-btn")) return;
        openDetail(card.dataset.detailType, card.dataset.name, card.dataset.meta);
      });
    });
  }

  function bindQuickActions() {
    const createTeamQuickBtn = qs("#createTeamQuickBtn");
    if (createTeamQuickBtn) createTeamQuickBtn.addEventListener("click", openTeamModal);

    const createTeamBtn = qs("#createTeamBtn");
    if (createTeamBtn) createTeamBtn.addEventListener("click", openTeamModal);

    const createPostBtn = qs("#createPostBtn");
    if (createPostBtn) createPostBtn.addEventListener("click", () => toast("Create Post is next."));

    const createTournamentBtn = qs("#createTournamentBtn");
    if (createTournamentBtn) createTournamentBtn.addEventListener("click", () => toast("Create Tournament is next."));

    const newPostQuickBtn = qs("#newPostQuickBtn");
    if (newPostQuickBtn) newPostQuickBtn.addEventListener("click", () => switchView("posts"));

    const joinTournamentQuickBtn = qs("#joinTournamentQuickBtn");
    if (joinTournamentQuickBtn) joinTournamentQuickBtn.addEventListener("click", () => switchView("tournaments"));

    const openNotificationsBtn = qs("#openNotificationsBtn");
    if (openNotificationsBtn) openNotificationsBtn.addEventListener("click", () => toast("Notifications panel coming soon."));

    const openProfileBtn = qs("#openProfileBtn");
    if (openProfileBtn) openProfileBtn.addEventListener("click", () => switchView("settings"));
  }

  function bindReportFlow() {
    const openBtn = qs("#openReportBtn");
    const closeBtn = qs("#closeReportModal");
    const cancelBtn = qs("#cancelReportBtn");
    const submitBtn = qs("#submitReportBtn");

    if (openBtn) openBtn.addEventListener("click", () => openReport({ type: "general", id: "manual" }));
    if (closeBtn) closeBtn.addEventListener("click", closeReport);
    if (cancelBtn) cancelBtn.addEventListener("click", closeReport);
    if (submitBtn) submitBtn.addEventListener("click", submitReport);

    qsa(".team-report-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openReport({ type: "team", id: "team-card" });
      });
    });

    qsa(".tag").forEach((tag) => {
      tag.addEventListener("click", () => {
        const body = qs("#reportBody");
        if (body && !body.value.trim()) body.value = tag.textContent.trim();
      });
    });
  }

  function bindDetailModal() {
    const closeA = qs("#closeDetailModal");
    const closeB = qs("#closeDetailBtn");
    if (closeA) closeA.addEventListener("click", closeDetail);
    if (closeB) closeB.addEventListener("click", closeDetail);
  }

  function bindTeamFlow() {
    const closeA = qs("#closeTeamModal");
    const closeB = qs("#cancelTeamBtn");
    const saveBtn = qs("#saveTeamBtn");

    if (closeA) closeA.addEventListener("click", closeTeamModal);
    if (closeB) closeB.addEventListener("click", closeTeamModal);
    if (saveBtn) saveBtn.addEventListener("click", handleCreateTeam);
  }

  function bindLogout() {
    const logoutBtn = qs("#logoutBtn");
    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        if (state.supabase) {
          const { error } = await state.supabase.auth.signOut({ scope: "global" });
          if (error) throw error;
        }
      } catch (err) {
        console.error("Logout failed:", err);
        toast(err.message || "Logout failed.");
      } finally {
        try { localStorage.clear(); } catch {}
        try { sessionStorage.clear(); } catch {}
        setLoggedIn(false);
        closeAuth();
        window.location.href = window.location.origin;
      }
    });
  }

  async function init() {
    initIntro();
    closeAuth();
    initSupabase();
    bindAuthFlow();
    bindNav();
    bindDetails();
    bindQuickActions();
    bindReportFlow();
    bindDetailModal();
    bindTeamFlow();
    bindLogout();

    const oauthTouched = await restoreOAuthSessionIfNeeded();
    let hasSession = await syncSession();

    if (!hasSession && oauthTouched) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await syncSession();
    }

    await loadTeams();

    if (state.supabase) {
      state.supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          setLoggedIn(true, session.user);
          closeAuth();
        } else {
          setLoggedIn(false);
        }
        await loadTeams();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
