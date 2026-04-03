
(() => {
  const state = { loggedIn:false, authMode:"signin", supabase:null, reportTarget:null };
  const cfg = window.STACKOPS_CONFIG || {};
  const qs = (s,p=document) => p.querySelector(s);
  const qsa = (s,p=document) => Array.from(p.querySelectorAll(s));
  const toast = (m) => alert(m);
  const show = (el) => el && el.classList.remove("hidden");
  const hide = (el) => el && el.classList.add("hidden");

  function initSupabase() {
    try {
      if (window.supabase && cfg.supabaseUrl && cfg.supabaseAnonKey &&
          !String(cfg.supabaseUrl).includes("YOUR_") &&
          !String(cfg.supabaseAnonKey).includes("PASTE_")) {
        state.supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
        });
      }
    } catch (e) { console.error("Supabase init failed:", e); }
  }

  async function restoreOAuthSessionIfNeeded() {
    if (!state.supabase) return;
    try {
      const url = new URL(window.location.href);
      const hasCode = !!url.searchParams.get("code");
      const hasHashToken = /access_token=/.test(window.location.hash || "");
      const hasErr = !!url.searchParams.get("error_description");
      if (hasCode && state.supabase.auth.exchangeCodeForSession) {
        const { error } = await state.supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) console.error("OAuth exchange failed:", error);
      }
      if (hasCode || hasHashToken || hasErr) {
        window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      }
    } catch (e) { console.error("OAuth restore failed:", e); }
  }

  function setLoggedIn(flag) {
    state.loggedIn = flag;
    const guestHome = qs("#guestHome");
    const appShell = qs("#appShell");
    const guestActions = qs("#guestActions");
    const userActions = qs("#userActions");
    if (flag) {
      hide(guestHome); show(appShell); hide(guestActions); show(userActions); closeAuth();
      if (appShell) { appShell.classList.add("ready"); appShell.style.opacity="1"; appShell.style.transform="none"; }
    } else {
      show(guestHome); hide(appShell); show(guestActions); hide(userActions);
      const profileBtn = qs("#openProfileBtn"); if (profileBtn) profileBtn.textContent = "My Profile";
    }
  }

  async function syncSession() {
    if (!state.supabase) return setLoggedIn(false);
    try {
      const { data, error } = await state.supabase.auth.getSession();
      if (error) throw error;
      const session = data?.session || null;
      if (session?.user) {
        setLoggedIn(true);
        const profileBtn = qs("#openProfileBtn");
        if (profileBtn && session.user.email) profileBtn.textContent = session.user.email;
        closeAuth();
      } else setLoggedIn(false);
    } catch (e) {
      console.error("Session sync failed:", e);
      setLoggedIn(false);
    }
  }

  function openAuth(mode="signin") {
    state.authMode = mode;
    const title = qs("#authTitle");
    if (title) title.textContent = mode === "signup" ? "Create account" : "Sign in";
    show(qs("#authModal"));
  }
  function closeAuth() { hide(qs("#authModal")); }

  function switchView(viewName) {
    qsa(".rail-item").forEach(b => b.classList.toggle("active", b.dataset.view === viewName));
    qsa(".view").forEach(v => v.classList.remove("active"));
    const panel = qs(`#view-${viewName}`); if (panel) panel.classList.add("active");
    const title = qs("#viewTitle");
    const activeBtn = qsa(".rail-item").find(b => b.dataset.view === viewName);
    if (title && activeBtn) title.textContent = activeBtn.textContent.trim();
  }

  function openDetail(type,name,meta) {
    const typeEl = qs("#detailType"), nameEl = qs("#detailName"), metaEl = qs("#detailMeta");
    if (typeEl) typeEl.textContent = `${String(type||"detail").toUpperCase()} VIEW`;
    if (nameEl) nameEl.textContent = name || "Item";
    if (metaEl) metaEl.textContent = meta || "";
    show(qs("#detailModal"));
  }
  function closeDetail(){ hide(qs("#detailModal")); }
  function openReport(target=null){ state.reportTarget=target; show(qs("#reportModal")); }
  function closeReport(){ hide(qs("#reportModal")); }

  async function fallbackSignin(email,password){
    const signin = await state.supabase.auth.signInWithPassword({ email, password });
    if (signin.error) throw signin.error;
    await syncSession(); closeAuth();
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
          if (/already registered|already exists|user already registered/i.test(msg)) return await fallbackSignin(email,password);
          throw result.error;
        }
        if (!result.data.session) {
          closeAuth();
          return toast("Account created. Check email if confirmation is enabled.");
        }
        await syncSession(); closeAuth(); return;
      }
      const signin = await state.supabase.auth.signInWithPassword({ email, password });
      if (signin.error) throw signin.error;
      await syncSession(); closeAuth();
    } catch (e) {
      console.error(e);
      toast(e.message || "Authentication failed.");
    }
  }

  async function handleGoogleAuth() {
    if (!cfg.googleEnabled) return toast("Enable Google provider in Supabase, then try again.");
    if (!state.supabase) return toast("Supabase is not configured yet. Add real values in config.js.");
    try {
      const { error } = await state.supabase.auth.signInWithOAuth({
        provider:"google",
        options:{ redirectTo: window.location.origin }
      });
      if (error) throw error;
    } catch (e) {
      console.error(e);
      toast(e.message || "Google login failed.");
    }
  }

  function bindAuthFlow() {
    qsa("[data-open-auth]").forEach(btn => btn.addEventListener("click", ()=>openAuth(btn.dataset.openAuth)));
    const closeBtn = qs("#closeAuthModal"); if (closeBtn) closeBtn.addEventListener("click", closeAuth);
    const submitBtn = qs("#submitAuthBtn"); if (submitBtn) submitBtn.addEventListener("click", handleEmailAuth);
    const googleBtn = qs("#googleBtn"); if (googleBtn) googleBtn.addEventListener("click", handleGoogleAuth);
    const riotBtn = qs("#riotBtn"); if (riotBtn) riotBtn.addEventListener("click", ()=>toast("Riot sign-in is coming soon."));
    const notificationsBtn = qs("#openNotificationsBtn"); if (notificationsBtn) notificationsBtn.addEventListener("click", ()=>toast("Notifications panel coming soon."));
    const profileBtn = qs("#openProfileBtn"); if (profileBtn) profileBtn.addEventListener("click", ()=>switchView("settings"));
  }

  function bindNav() { qsa(".rail-item").forEach(btn => btn.addEventListener("click", ()=>switchView(btn.dataset.view))); }

  function bindDetails() {
    qsa(".entity-card.clickable").forEach(card => card.addEventListener("click", (e)=>{
      if (e.target.closest(".team-report-btn")) return;
      openDetail(card.dataset.detailType, card.dataset.name, card.dataset.meta);
    }));
    qsa(".detail-trigger").forEach(btn => btn.addEventListener("click", (e)=>{
      e.stopPropagation(); openDetail(btn.dataset.type, btn.dataset.title, btn.dataset.meta);
    }));
  }

  function bindQuickActions() {
    const wire = (selector, view, title, meta) => {
      const btn = qs(selector); if (!btn) return;
      btn.addEventListener("click", ()=>{ if (view) switchView(view); if (title) openDetail("action", title, meta || ""); });
    };
    wire("#createTeamQuickBtn","teams","Create team","Team creation backend hook can be connected here.");
    wire("#createTeamBtn","teams","Create team","Team creation backend hook can be connected here.");
    wire("#createPostBtn","posts","Create post","Post composer backend hook can be connected here.");
    wire("#createTournamentBtn","tournaments","Create tournament","Tournament creation backend hook can be connected here.");
    const newPostQuickBtn = qs("#newPostQuickBtn"); if (newPostQuickBtn) newPostQuickBtn.addEventListener("click", ()=>switchView("posts"));
    const joinTournamentQuickBtn = qs("#joinTournamentQuickBtn"); if (joinTournamentQuickBtn) joinTournamentQuickBtn.addEventListener("click", ()=>switchView("tournaments"));
  }

  function bindReportFlow() {
    const openBtn = qs("#openReportBtn"), closeBtn=qs("#closeReportModal"), cancelBtn=qs("#cancelReportBtn"), submitBtn=qs("#submitReportBtn");
    if (openBtn) openBtn.addEventListener("click", ()=>openReport({type:"general",id:"manual"}));
    if (closeBtn) closeBtn.addEventListener("click", closeReport);
    if (cancelBtn) cancelBtn.addEventListener("click", closeReport);
    if (submitBtn) submitBtn.addEventListener("click", async ()=>{
      const body = qs("#reportBody")?.value?.trim() || "";
      const payload = { target:state.reportTarget, details:body, createdAt:new Date().toISOString() };
      if (state.supabase) {
        try {
          const { error } = await state.supabase.from("reports").insert({
            target_type: payload.target?.type || "unknown",
            target_id: payload.target?.id || null,
            reason: body || "manual report",
            details: JSON.stringify(payload)
          });
          if (error) throw error;
          closeReport(); return toast("Report submitted.");
        } catch (e) { console.error("Remote report failed, using local fallback:", e); }
      }
      const existing = JSON.parse(localStorage.getItem("stackops_reports") || "[]");
      existing.push(payload);
      localStorage.setItem("stackops_reports", JSON.stringify(existing));
      closeReport(); toast("Report saved locally.");
    });
    qsa(".tag").forEach(tag => tag.addEventListener("click", ()=>{ const body=qs("#reportBody"); if (body && !body.value.trim()) body.value = tag.textContent.trim(); }));
    qsa(".team-report-btn").forEach(btn => btn.addEventListener("click",(e)=>{ e.stopPropagation(); openReport({type:"team", id:"team-card"}); }));
  }

  function bindDetailModal() {
    const closeA = qs("#closeDetailModal"), closeB = qs("#closeDetailBtn");
    if (closeA) closeA.addEventListener("click", closeDetail);
    if (closeB) closeB.addEventListener("click", closeDetail);
  }

  function bindAvatarUpload() {
    const input = qs("#avatarInput"), preview = qs("#avatarPreview"), genBtn = qs("#generateAvatarBtn");
    if (input && preview) input.addEventListener("change", ()=>{
      const file = input.files && input.files[0]; if (!file) return;
      const reader = new FileReader(); reader.onload = (e)=>{ preview.src = e.target.result; }; reader.readAsDataURL(file);
    });
    if (genBtn && preview) genBtn.addEventListener("click", ()=>{
      const colors=["#8fe8ff","#f0d56f","#7fd1ff","#9effc2"], c=colors[Math.floor(Math.random()*colors.length)];
      const svg=`<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><rect width='100%' height='100%' rx='42' fill='#081326'/><circle cx='128' cy='96' r='42' fill='${c}'/><rect x='58' y='154' width='140' height='56' rx='28' fill='${c}' opacity='.9'/></svg>`;
      preview.src = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
    });
  }

  function bindLogout() {
    const logoutBtn = qs("#logoutBtn"); if (!logoutBtn) return;
    logoutBtn.addEventListener("click", async ()=>{
      try {
        if (state.supabase) {
          const { error } = await state.supabase.auth.signOut({ scope:"local" });
          if (error) throw error;
        }
      } catch (e) {
        console.error(e); toast(e.message || "Logout failed.");
      } finally {
        setLoggedIn(false); closeAuth(); window.location.href = window.location.origin;
      }
    });
  }

  function initIntro() {
    const intro = qs("#introScreen"); if (!intro) return;
    let finished = false;
    const hideIntro = ()=> {
      if (finished) return; finished = true;
      intro.classList.add("hide");
      setTimeout(()=>{ if (intro.parentNode) intro.parentNode.removeChild(intro); }, 1200);
    };
    window.addEventListener("load", ()=>setTimeout(hideIntro, 2100), { once:true });
    setTimeout(hideIntro, 4200);
  }

  async function init() {
    closeAuth();
    initSupabase();
    bindAuthFlow();
    bindNav();
    bindDetails();
    bindQuickActions();
    bindReportFlow();
    bindDetailModal();
    bindAvatarUpload();
    bindLogout();
    initIntro();
    await restoreOAuthSessionIfNeeded();
    await syncSession();
    if (state.supabase) {
      state.supabase.auth.onAuthStateChange(async (event)=>{
        if (event === "SIGNED_OUT") { setLoggedIn(false); closeAuth(); return; }
        await syncSession(); closeAuth();
      });
    } else {
      setLoggedIn(false);
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once:true });
})();
