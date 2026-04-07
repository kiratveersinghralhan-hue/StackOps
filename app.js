(() => {
  const state = {
    loggedIn: false,
    authMode: "signin",
    supabase: null,
    reportTarget: null,
    currentUser: null,
    deleteTeamId: null,
    deletePostId: null,
    deleteTournamentId: null
  };

  const cfg = window.STACKOPS_CONFIG || {};
  const qs = (s,p=document)=>p.querySelector(s);
  const qsa = (s,p=document)=>Array.from(p.querySelectorAll(s));
  const toast = (m)=>alert(m);
  const esc = (v)=>String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");

  const show = (el)=>{ if(el){ el.classList.remove("hidden"); el.style.display=""; } };
  const hide = (el)=>{ if(el){ el.classList.add("hidden"); el.style.display="none"; } };

  function initSupabase() {
    try {
      if (window.supabase && cfg.supabaseUrl && cfg.supabaseAnonKey &&
          !String(cfg.supabaseUrl).includes("YOUR_") &&
          !String(cfg.supabaseAnonKey).includes("PASTE_")) {
        state.supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:"pkce" }
        });
      }
    } catch (e) { console.error("Supabase init failed:", e); }
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
    } catch (e) { console.error("OAuth restore failed:", e); }
    return touched;
  }

  function initIntro() {
    const intro = qs("#introScreen");
    if (!intro) return;
    let finished = false;
    const hideIntro = ()=> {
      if (finished) return;
      finished = true;
      intro.classList.add("hide");
      setTimeout(()=>{ if (intro.parentNode) intro.parentNode.removeChild(intro); }, 1200);
    };
    window.addEventListener("load", ()=>setTimeout(hideIntro, 2100), { once:true });
    setTimeout(hideIntro, 4200);
  }

  function setLoggedIn(flag, user=null) {
    state.loggedIn = flag;
    state.currentUser = user || null;
    const guestHome = qs("#guestHome");
    const appShell = qs("#appShell");
    const guestActions = qs("#guestActions");
    const userActions = qs("#userActions");
    if (flag) {
      hide(guestHome); show(appShell); hide(guestActions); show(userActions); closeAuth();
      if (appShell) { appShell.classList.add("ready"); appShell.style.opacity="1"; appShell.style.transform="none"; }
      const profileBtn = qs("#openProfileBtn");
      if (profileBtn && user?.email) profileBtn.textContent = user.email;
    } else {
      show(guestHome); hide(appShell); show(guestActions); hide(userActions);
      const profileBtn = qs("#openProfileBtn"); if (profileBtn) profileBtn.textContent = "My Profile";
    }
  }

  async function syncSession() {
    if (!state.supabase) { setLoggedIn(false); return false; }
    try {
      const { data, error } = await state.supabase.auth.getSession();
      if (error) throw error;
      const session = data?.session || null;
      if (session?.user) {
        setLoggedIn(true, session.user);
        closeAuth();
        return true;
      } else {
        setLoggedIn(false);
        return false;
      }
    } catch (e) {
      console.error("Session sync failed:", e);
      setLoggedIn(false);
      return false;
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

  const openTeamModal = ()=>show(qs("#teamModal"));
  const closeTeamModal = ()=>hide(qs("#teamModal"));
  const openPostModal = ()=>show(qs("#postModal"));
  const closePostModal = ()=>hide(qs("#postModal"));
  const openTournamentModal = ()=>show(qs("#tournamentModal"));
  const closeTournamentModal = ()=>hide(qs("#tournamentModal"));

  function openDeleteTeamModal(id,name){ state.deleteTeamId=id; const t=qs("#deleteTeamText"); if(t) t.textContent=`Delete "${name||"this team"}" permanently?`; show(qs("#deleteTeamModal")); }
  function closeDeleteTeamModal(){ state.deleteTeamId=null; hide(qs("#deleteTeamModal")); }
  function openDeletePostModal(id,title){ state.deletePostId=id; const t=qs("#deletePostText"); if(t) t.textContent=`Delete "${title||"this post"}" permanently?`; show(qs("#deletePostModal")); }
  function closeDeletePostModal(){ state.deletePostId=null; hide(qs("#deletePostModal")); }
  function openDeleteTournamentModal(id,name){ state.deleteTournamentId=id; const t=qs("#deleteTournamentText"); if(t) t.textContent=`Delete "${name||"this tournament"}" permanently?`; show(qs("#deleteTournamentModal")); }
  function closeDeleteTournamentModal(){ state.deleteTournamentId=null; hide(qs("#deleteTournamentModal")); }

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

  async function currentUserOrToast() {
    const { data, error } = await state.supabase.auth.getSession();
    if (error) throw error;
    const user = data?.session?.user;
    if (!user) {
      toast("Please log in first.");
      return null;
    }
    return user;
  }

  function renderTeamCard(team){
    const canDelete = !!(state.currentUser && team.created_by === state.currentUser.id);
    return `<article class="entity-card clickable" data-detail-type="team" data-name="${esc(team.name || "Team")}" data-meta="${esc(team.status || "Recruiting")} • ${esc(team.region || "Unknown region")} • ${esc(team.rank_target || "Any rank")}">
      <div class="entity-main">
        <h4>${esc(team.name || "Unnamed Team")}</h4>
        <p>${esc(team.description || "No description yet.")}</p>
      </div>
      <div class="entity-actions-inline">
        ${canDelete ? `<button class="btn danger small delete-team-btn" data-id="${esc(team.id)}" data-name="${esc(team.name || "Team")}" type="button">Delete</button>` : ``}
        <button class="btn ghost small team-report-btn" data-id="${esc(team.id)}" type="button">Report</button>
      </div>
    </article>`;
  }

  function renderPostCard(post){
    const canDelete = !!(state.currentUser && post.created_by === state.currentUser.id);
    return `<article class="entity-card clickable" data-detail-type="post" data-name="${esc(post.title || "Post")}" data-meta="Posted by community">
      <div class="entity-main">
        <h4>${esc(post.title || "Untitled post")}</h4>
        <p>${esc(post.content || "")}</p>
      </div>
      <div class="entity-actions-inline">
        ${canDelete ? `<button class="btn danger small delete-post-btn" data-id="${esc(post.id)}" data-title="${esc(post.title || "Post")}" type="button">Delete</button>` : ``}
      </div>
    </article>`;
  }

  function renderTournamentCard(item){
    const canDelete = !!(state.currentUser && item.created_by === state.currentUser.id);
    const when = item.start_date ? new Date(item.start_date).toLocaleString() : "TBD";
    return `<article class="entity-card clickable" data-detail-type="tournament" data-name="${esc(item.name || "Tournament")}" data-meta="${esc(item.region || "Unknown region")} • ${esc(when)}">
      <div class="entity-main">
        <h4>${esc(item.name || "Untitled tournament")}</h4>
        <p>${esc(item.description || "No description yet.")}</p>
      </div>
      <div class="entity-actions-inline">
        ${canDelete ? `<button class="btn danger small delete-tournament-btn" data-id="${esc(item.id)}" data-name="${esc(item.name || "Tournament")}" type="button">Delete</button>` : ``}
      </div>
    </article>`;
  }

  async function loadTeams(){
    const root = qs("#teamsList");
    if (!root || !state.supabase) return;
    try {
      const { data, error } = await state.supabase.from("teams").select("*").order("created_at",{ascending:false});
      if (error) throw error;
      root.innerHTML = (!data || !data.length) ? `<div class="panel">No teams yet.</div>` : data.map(renderTeamCard).join("");
      bindDetails(); bindTeamCardButtons();
    } catch(e){ console.error(e); root.innerHTML = `<div class="panel">Could not load teams.</div>`; }
  }

  async function loadPosts(){
    const root = qs("#postsList");
    if (!root || !state.supabase) return;
    try {
      const { data, error } = await state.supabase.from("posts").select("*").order("created_at",{ascending:false});
      if (error) throw error;
      root.innerHTML = (!data || !data.length) ? `<div class="panel">No posts yet.</div>` : data.map(renderPostCard).join("");
      bindDetails(); bindPostCardButtons();
    } catch(e){ console.error(e); root.innerHTML = `<div class="panel">Could not load posts.</div>`; }
  }

  async function loadTournaments(){
    const root = qs("#tournamentsList");
    if (!root || !state.supabase) return;
    try {
      const { data, error } = await state.supabase.from("tournaments").select("*").order("created_at",{ascending:false});
      if (error) throw error;
      root.innerHTML = (!data || !data.length) ? `<div class="panel">No tournaments yet.</div>` : data.map(renderTournamentCard).join("");
      bindDetails(); bindTournamentCardButtons();
    } catch(e){ console.error(e); root.innerHTML = `<div class="panel">Could not load tournaments.</div>`; }
  }

  async function handleCreateTeam(){
    if (!state.supabase) return toast("Supabase is not configured yet.");
    const name = qs("#teamName")?.value?.trim();
    const description = qs("#teamDescription")?.value?.trim() || "";
    const region = qs("#teamRegion")?.value?.trim() || "";
    const rankTarget = qs("#teamRankTarget")?.value?.trim() || "";
    if (!name) return toast("Enter team name.");
    try {
      const user = await currentUserOrToast(); if (!user) return;
      let payload = { created_by:user.id, name, description, region, rank_target:rankTarget, status:"Recruiting" };
      let { error } = await state.supabase.from("teams").insert(payload);
      if (error && /rank_target/i.test(error.message||"")) { delete payload.rank_target; ({ error } = await state.supabase.from("teams").insert(payload)); }
      if (error) throw error;
      ["#teamName","#teamDescription","#teamRegion","#teamRankTarget"].forEach(sel=>{ const el=qs(sel); if(el) el.value=""; });
      closeTeamModal(); await loadTeams(); switchView("teams"); toast("Team created.");
    } catch(e){ console.error(e); toast(e.message || "Could not create team."); }
  }

  async function handleDeleteTeam(){
    if (!state.supabase || !state.deleteTeamId) return;
    try {
      const { error } = await state.supabase.from("teams").delete().eq("id", state.deleteTeamId);
      if (error) throw error;
      closeDeleteTeamModal(); await loadTeams(); toast("Team deleted.");
    } catch(e){ console.error(e); toast(e.message || "Could not delete team."); }
  }

  async function handleCreatePost(){
    if (!state.supabase) return toast("Supabase is not configured yet.");
    const title = qs("#postTitle")?.value?.trim() || "";
    const content = qs("#postContent")?.value?.trim() || "";
    if (!content) return toast("Write something for the post.");
    try {
      const user = await currentUserOrToast(); if (!user) return;
      let payload = { created_by:user.id, title, content };
      let { error } = await state.supabase.from("posts").insert(payload);
      if (error && /title/i.test(error.message||"")) { payload = { created_by:user.id, content }; ({ error } = await state.supabase.from("posts").insert(payload)); }
      if (error) throw error;
      if (qs("#postTitle")) qs("#postTitle").value = "";
      if (qs("#postContent")) qs("#postContent").value = "";
      closePostModal(); await loadPosts(); switchView("posts"); toast("Post published.");
    } catch(e){ console.error(e); toast(e.message || "Could not create post."); }
  }

  async function handleDeletePost(){
    if (!state.supabase || !state.deletePostId) return;
    try {
      const { error } = await state.supabase.from("posts").delete().eq("id", state.deletePostId);
      if (error) throw error;
      closeDeletePostModal(); await loadPosts(); toast("Post deleted.");
    } catch(e){ console.error(e); toast(e.message || "Could not delete post."); }
  }

  async function handleCreateTournament(){
    if (!state.supabase) return toast("Supabase is not configured yet.");
    const name = qs("#tournamentName")?.value?.trim();
    const description = qs("#tournamentDescription")?.value?.trim() || "";
    const region = qs("#tournamentRegion")?.value?.trim() || "";
    const startDate = qs("#tournamentStart")?.value || null;
    if (!name) return toast("Enter tournament name.");
    try {
      const user = await currentUserOrToast(); if (!user) return;
      let payload = { created_by:user.id, name, description, region, start_date:startDate };
      let { error } = await state.supabase.from("tournaments").insert(payload);
      if (error && /description/i.test(error.message||"")) { delete payload.description; ({ error } = await state.supabase.from("tournaments").insert(payload)); }
      if (error) throw error;
      ["#tournamentName","#tournamentDescription","#tournamentRegion","#tournamentStart"].forEach(sel=>{ const el=qs(sel); if(el) el.value=""; });
      closeTournamentModal(); await loadTournaments(); switchView("tournaments"); toast("Tournament created.");
    } catch(e){ console.error(e); toast(e.message || "Could not create tournament."); }
  }

  async function handleDeleteTournament(){
    if (!state.supabase || !state.deleteTournamentId) return;
    try {
      const { error } = await state.supabase.from("tournaments").delete().eq("id", state.deleteTournamentId);
      if (error) throw error;
      closeDeleteTournamentModal(); await loadTournaments(); toast("Tournament deleted.");
    } catch(e){ console.error(e); toast(e.message || "Could not delete tournament."); }
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
      if (e.target.closest(".team-report-btn") || e.target.closest(".delete-team-btn") || e.target.closest(".delete-post-btn") || e.target.closest(".delete-tournament-btn")) return;
      openDetail(card.dataset.detailType, card.dataset.name, card.dataset.meta);
    }));
    qsa(".detail-trigger").forEach(btn => btn.addEventListener("click", (e)=>{
      e.stopPropagation(); openDetail(btn.dataset.type, btn.dataset.title, btn.dataset.meta);
    }));
  }

  function bindQuickActions() {
    const teamQuick = qs("#createTeamQuickBtn"); if (teamQuick) teamQuick.addEventListener("click", openTeamModal);
    const teamBtn = qs("#createTeamBtn"); if (teamBtn) teamBtn.addEventListener("click", openTeamModal);
    const postBtn = qs("#createPostBtn"); if (postBtn) postBtn.addEventListener("click", openPostModal);
    const tourBtn = qs("#createTournamentBtn"); if (tourBtn) tourBtn.addEventListener("click", openTournamentModal);
    const newPostQuickBtn = qs("#newPostQuickBtn"); if (newPostQuickBtn) newPostQuickBtn.addEventListener("click", openPostModal);
    const joinTournamentQuickBtn = qs("#joinTournamentQuickBtn"); if (joinTournamentQuickBtn) joinTournamentQuickBtn.addEventListener("click", openTournamentModal);
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
          const { data } = await state.supabase.auth.getSession();
          const reporter = data?.session?.user || null;
          const { error } = await state.supabase.from("reports").insert({
            reporter_id: reporter?.id || null,
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
    qsa(".team-report-btn").forEach(btn => btn.addEventListener("click",(e)=>{ e.stopPropagation(); openReport({type:"team", id:btn.dataset.id || "team-card"}); }));
  }

  function bindDetailModal() {
    const closeA = qs("#closeDetailModal"), closeB = qs("#closeDetailBtn");
    if (closeA) closeA.addEventListener("click", closeDetail);
    if (closeB) closeB.addEventListener("click", closeDetail);
  }

  function bindTeamFlow() {
    const a=qs("#closeTeamModal"), b=qs("#cancelTeamBtn"), c=qs("#saveTeamBtn");
    if(a) a.addEventListener("click", closeTeamModal);
    if(b) b.addEventListener("click", closeTeamModal);
    if(c) c.addEventListener("click", handleCreateTeam);
    const d=qs("#closeDeleteTeamModal"), e=qs("#cancelDeleteTeamBtn"), f=qs("#confirmDeleteTeamBtn");
    if(d) d.addEventListener("click", closeDeleteTeamModal);
    if(e) e.addEventListener("click", closeDeleteTeamModal);
    if(f) f.addEventListener("click", handleDeleteTeam);
  }

  function bindPostFlow() {
    const a=qs("#closePostModal"), b=qs("#cancelPostBtn"), c=qs("#savePostBtn");
    if(a) a.addEventListener("click", closePostModal);
    if(b) b.addEventListener("click", closePostModal);
    if(c) c.addEventListener("click", handleCreatePost);
    const d=qs("#closeDeletePostModal"), e=qs("#cancelDeletePostBtn"), f=qs("#confirmDeletePostBtn");
    if(d) d.addEventListener("click", closeDeletePostModal);
    if(e) e.addEventListener("click", closeDeletePostModal);
    if(f) f.addEventListener("click", handleDeletePost);
  }

  function bindTournamentFlow() {
    const a=qs("#closeTournamentModal"), b=qs("#cancelTournamentBtn"), c=qs("#saveTournamentBtn");
    if(a) a.addEventListener("click", closeTournamentModal);
    if(b) b.addEventListener("click", closeTournamentModal);
    if(c) c.addEventListener("click", handleCreateTournament);
    const d=qs("#closeDeleteTournamentModal"), e=qs("#cancelDeleteTournamentBtn"), f=qs("#confirmDeleteTournamentBtn");
    if(d) d.addEventListener("click", closeDeleteTournamentModal);
    if(e) e.addEventListener("click", closeDeleteTournamentModal);
    if(f) f.addEventListener("click", handleDeleteTournament);
  }

  function bindTeamCardButtons(){
    qsa(".delete-team-btn").forEach(btn => btn.addEventListener("click",(e)=>{ e.stopPropagation(); openDeleteTeamModal(btn.dataset.id, btn.dataset.name); }));
    qsa(".team-report-btn").forEach(btn => btn.addEventListener("click",(e)=>{ e.stopPropagation(); openReport({type:"team", id:btn.dataset.id || "team-card"}); }));
  }

  function bindPostCardButtons(){
    qsa(".delete-post-btn").forEach(btn => btn.addEventListener("click",(e)=>{ e.stopPropagation(); openDeletePostModal(btn.dataset.id, btn.dataset.title); }));
  }

  function bindTournamentCardButtons(){
    qsa(".delete-tournament-btn").forEach(btn => btn.addEventListener("click",(e)=>{ e.stopPropagation(); openDeleteTournamentModal(btn.dataset.id, btn.dataset.name); }));
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

  async function init() {
    closeAuth();
    initSupabase();
    bindAuthFlow();
    bindNav();
    bindDetails();
    bindQuickActions();
    bindReportFlow();
    bindDetailModal();
    bindTeamFlow();
    bindPostFlow();
    bindTournamentFlow();
    bindAvatarUpload();
    bindLogout();
    initIntro();
    const oauthTouched = await restoreOAuthSessionIfNeeded();
    await syncSession();
    if (oauthTouched) await syncSession();
    await loadTeams();
    await loadPosts();
    await loadTournaments();
    if (state.supabase) {
      state.supabase.auth.onAuthStateChange(async (event, session)=>{
        if (event === "SIGNED_OUT") { setLoggedIn(false); closeAuth(); return; }
        setLoggedIn(!!session?.user, session?.user || null);
        await loadTeams(); await loadPosts(); await loadTournaments();
      });
    } else {
      setLoggedIn(false);
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once:true });
})();
