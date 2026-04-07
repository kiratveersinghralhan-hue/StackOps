(() => {
  const state = { loggedIn:false, authMode:"signin", supabase:null, currentUser:null, reportTarget:null, deleteTeamId:null, deletePostId:null, deleteTournamentId:null };
  const cfg = window.STACKOPS_CONFIG || {};
  const qs = (s,p=document)=>p.querySelector(s);
  const qsa = (s,p=document)=>Array.from(p.querySelectorAll(s));
  const toast = (m)=>alert(m);

  function show(el){ if(!el) return; el.classList.remove("hidden"); el.style.display=""; }
  function hide(el){ if(!el) return; el.classList.add("hidden"); el.style.display="none"; }
  const esc = (v)=>String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");

  function initIntro(){
    const intro = qs("#introScreen"); if(!intro) return;
    let done=false;
    const finish=()=>{ if(done) return; done=true; intro.classList.add("hide"); setTimeout(()=>{ if(intro.parentNode) intro.parentNode.removeChild(intro); },900); };
    window.addEventListener("load",()=>setTimeout(finish,1600),{once:true});
    setTimeout(finish,3500);
  }

  function initSupabase(){
    try{
      if(window.supabase && cfg.supabaseUrl && cfg.supabaseAnonKey && !String(cfg.supabaseUrl).includes("YOUR_") && !String(cfg.supabaseAnonKey).includes("PASTE_")){
        state.supabase = window.supabase.createClient(String(cfg.supabaseUrl).trim(), String(cfg.supabaseAnonKey).trim(), {
          auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:"pkce" }
        });
      }
    }catch(err){ console.error("Supabase init failed:", err); }
  }

  async function restoreOAuthSessionIfNeeded(){
    if(!state.supabase) return false;
    let touched=false;
    try{
      const url = new URL(window.location.href);
      const hasCode = !!url.searchParams.get("code");
      const hasHashToken = /access_token=/.test(window.location.hash || "");
      const hasErr = !!url.searchParams.get("error_description");
      if(hasCode && state.supabase.auth.exchangeCodeForSession){
        const { error } = await state.supabase.auth.exchangeCodeForSession(window.location.href);
        if(error) console.error("OAuth exchange failed:", error);
        touched=true;
      }
      if(hasCode || hasHashToken || hasErr) touched=true;
      if(touched) window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
    }catch(err){ console.error("OAuth restore failed:", err); }
    return touched;
  }

  function setLoggedIn(flag, user=null){
    state.loggedIn=flag; state.currentUser=user || null;
    const guestHome=qs("#guestHome"), appShell=qs("#appShell"), guestActions=qs("#guestActions"), userActions=qs("#userActions");
    if(flag){
      hide(guestHome); show(appShell); hide(guestActions); show(userActions);
      if(appShell){ appShell.classList.add("ready"); appShell.style.opacity="1"; appShell.style.transform="none"; appShell.style.visibility="visible"; }
      const profileBtn=qs("#openProfileBtn"); if(profileBtn && user?.email) profileBtn.textContent=user.email;
      closeAuth();
    }else{
      show(guestHome); hide(appShell); show(guestActions); hide(userActions);
      const profileBtn=qs("#openProfileBtn"); if(profileBtn) profileBtn.textContent="My Profile";
    }
  }

  async function syncSession(){
    if(!state.supabase){ setLoggedIn(false); return false; }
    try{
      const { data, error } = await state.supabase.auth.getSession();
      if(error) throw error;
      const user = data?.session?.user || null;
      if(user){ setLoggedIn(true, user); return true; }
      setLoggedIn(false); return false;
    }catch(err){ console.error("Session sync failed:", err); setLoggedIn(false); return false; }
  }

  function openAuth(mode="signin"){ state.authMode=mode; const title=qs("#authTitle"); if(title) title.textContent=mode==="signup"?"Create account":"Sign in"; show(qs("#authModal")); }
  function closeAuth(){ hide(qs("#authModal")); }
  function openDetail(type,name,meta){ const a=qs("#detailType"), b=qs("#detailName"), c=qs("#detailMeta"); if(a) a.textContent=`${String(type||"detail").toUpperCase()} VIEW`; if(b) b.textContent=name||"Item"; if(c) c.textContent=meta||""; show(qs("#detailModal")); }
  function closeDetail(){ hide(qs("#detailModal")); }
  function openReport(target=null){ state.reportTarget=target; show(qs("#reportModal")); }
  function closeReport(){ hide(qs("#reportModal")); }
  function openTeamModal(){ show(qs("#teamModal")); } function closeTeamModal(){ hide(qs("#teamModal")); }
  function openPostModal(){ show(qs("#postModal")); } function closePostModal(){ hide(qs("#postModal")); }
  function openTournamentModal(){ show(qs("#tournamentModal")); } function closeTournamentModal(){ hide(qs("#tournamentModal")); }
  function openDeleteTeamModal(id,name){ state.deleteTeamId=id; const t=qs("#deleteTeamText"); if(t) t.textContent=`Delete "${name||"this team"}" permanently?`; show(qs("#deleteTeamModal")); }
  function closeDeleteTeamModal(){ state.deleteTeamId=null; hide(qs("#deleteTeamModal")); }
  function openDeletePostModal(id,title){ state.deletePostId=id; const t=qs("#deletePostText"); if(t) t.textContent=`Delete "${title||"this post"}" permanently?`; show(qs("#deletePostModal")); }
  function closeDeletePostModal(){ state.deletePostId=null; hide(qs("#deletePostModal")); }
  function openDeleteTournamentModal(id,name){ state.deleteTournamentId=id; const t=qs("#deleteTournamentText"); if(t) t.textContent=`Delete "${name||"this tournament"}" permanently?`; show(qs("#deleteTournamentModal")); }
  function closeDeleteTournamentModal(){ state.deleteTournamentId=null; hide(qs("#deleteTournamentModal")); }

  async function fallbackSignin(email,password){
    const signin = await state.supabase.auth.signInWithPassword({ email, password });
    if(signin.error) throw signin.error;
    await syncSession(); closeAuth();
  }

  async function handleEmailAuth(){
    const email = qs("#authEmail")?.value?.trim();
    const password = qs("#authPassword")?.value || "";
    if(!state.supabase) return toast("Supabase is not configured yet. Add real values in config.js.");
    if(!email || !password) return toast("Enter email and password.");
    try{
      if(state.authMode==="signup"){
        const result = await state.supabase.auth.signUp({ email, password });
        if(result.error){
          const msg=result.error.message||"";
          if(/already registered|already exists|user already registered/i.test(msg)){ await fallbackSignin(email,password); return; }
          throw result.error;
        }
        if(!result.data.session){ closeAuth(); toast("Account created. Check email if confirmation is enabled."); return; }
        await syncSession(); closeAuth(); return;
      }
      const signin = await state.supabase.auth.signInWithPassword({ email, password });
      if(signin.error) throw signin.error;
      await syncSession(); closeAuth();
    }catch(err){ console.error(err); toast(err.message || "Authentication failed."); }
  }

  async function handleGoogleAuth(){
    if(!cfg.googleEnabled) return toast("Enable Google provider in Supabase, then try again.");
    if(!state.supabase) return toast("Supabase is not configured yet. Add real values in config.js.");
    try{
      closeAuth();
      const { error } = await state.supabase.auth.signInWithOAuth({ provider:"google", options:{ redirectTo:window.location.origin } });
      if(error) throw error;
    }catch(err){ console.error(err); toast(err.message || "Google login failed."); }
  }

  async function submitReport(){
    const body = qs("#reportBody")?.value?.trim() || "";
    const payload = { target:state.reportTarget, details:body, createdAt:new Date().toISOString() };
    if(state.supabase){
      try{
        const { data: sessionData } = await state.supabase.auth.getSession();
        const reporter = sessionData?.session?.user || null;
        const { error } = await state.supabase.from("reports").insert({
          reporter_id: reporter?.id || null,
          target_type: payload.target?.type || "unknown",
          target_id: payload.target?.id || null,
          reason: body || "manual report",
          details: JSON.stringify(payload)
        });
        if(error) throw error;
        closeReport(); toast("Report submitted."); return;
      }catch(err){ console.error("Remote report failed:", err); }
    }
    closeReport(); toast("Report saved.");
  }

  function renderTeamCard(team){
    const canDelete = !!(state.currentUser && team.created_by === state.currentUser.id);
    const roleNeeded = team.role_needed || "Any";
    return `<article class="entity-card clickable" data-detail-type="team" data-name="${esc(team.name||"Team")}" data-meta="${esc(team.status||"Recruiting")} • ${esc(team.region||"Unknown region")} • ${esc(team.rank_target||"Any rank")} • ${esc(roleNeeded)}">
      <div class="entity-main">
        <h4>${esc(team.name||"Unnamed Team")}</h4>
        <p>${esc(team.description||"No description yet.")}</p>
        <div class="entity-meta"><span>${esc(team.status||"Recruiting")}</span><span>•</span><span>${esc(team.region||"Unknown region")}</span><span>•</span><span>${esc(team.rank_target||"Any rank")}</span><span>•</span><span>${esc(roleNeeded)}</span></div>
      </div>
      <div class="entity-actions-inline">
        ${canDelete ? `<button class="btn danger small delete-team-btn" data-id="${esc(team.id)}" data-name="${esc(team.name||"Team")}" type="button">Delete</button>` : ""}
        <button class="btn ghost small team-report-btn" data-id="${esc(team.id)}" type="button">Report</button>
      </div>
    </article>`;
  }

  function renderPostCard(post){
    const canDelete = !!(state.currentUser && post.created_by === state.currentUser.id);
    return `<article class="entity-card clickable" data-detail-type="post" data-name="${esc(post.title||"Post")}" data-meta="Posted by community">
      <div class="entity-main"><h4>${esc(post.title||"Untitled post")}</h4><p>${esc(post.content||"")}</p></div>
      <div class="entity-actions-inline">${canDelete ? `<button class="btn danger small delete-post-btn" data-id="${esc(post.id)}" data-title="${esc(post.title||"Post")}" type="button">Delete</button>` : ""}</div>
    </article>`;
  }

  function renderTournamentCard(item){
    const canDelete = !!(state.currentUser && item.created_by === state.currentUser.id);
    const start = item.start_date ? new Date(item.start_date).toLocaleString() : "TBD";
    return `<article class="entity-card clickable" data-detail-type="tournament" data-name="${esc(item.name||"Tournament")}" data-meta="${esc(item.region||"Unknown region")} • ${esc(start)}">
      <div class="entity-main">
        <h4>${esc(item.name||"Untitled tournament")}</h4>
        <p>${esc(item.description||"No description yet.")}</p>
        <div class="entity-meta"><span>${esc(item.region||"Unknown region")}</span><span>•</span><span>${esc(start)}</span></div>
      </div>
      <div class="entity-actions-inline">${canDelete ? `<button class="btn danger small delete-tournament-btn" data-id="${esc(item.id)}" data-name="${esc(item.name||"Tournament")}" type="button">Delete</button>` : ""}</div>
    </article>`;
  }

  async function loadTeams(){
    const root=qs("#teamsList"); if(!root || !state.supabase) return;
    try{
      const { data, error } = await state.supabase.from("teams").select("*").order("created_at", { ascending:false });
      if(error) throw error;
      root.innerHTML = (!data || !data.length) ? `<div class="panel">No teams yet.</div>` : data.map(renderTeamCard).join("");
      bindDetails(); bindTeamCardButtons();
    }catch(err){ console.error("Load teams failed:", err); root.innerHTML=`<div class="panel">Could not load teams.</div>`; }
  }

  async function loadPosts(){
    const root=qs("#postsList"); if(!root || !state.supabase) return;
    try{
      const { data, error } = await state.supabase.from("posts").select("*").order("created_at", { ascending:false });
      if(error) throw error;
      root.innerHTML = (!data || !data.length) ? `<div class="panel">No posts yet.</div>` : data.map(renderPostCard).join("");
      bindDetails(); bindPostCardButtons();
    }catch(err){ console.error("Load posts failed:", err); root.innerHTML=`<div class="panel">Could not load posts.</div>`; }
  }

  async function loadTournaments(){
    const root=qs("#tournamentsList"); if(!root || !state.supabase) return;
    try{
      const { data, error } = await state.supabase.from("tournaments").select("*").order("created_at", { ascending:false });
      if(error) throw error;
      root.innerHTML = (!data || !data.length) ? `<div class="panel">No tournaments yet.</div>` : data.map(renderTournamentCard).join("");
      bindDetails(); bindTournamentCardButtons();
    }catch(err){ console.error("Load tournaments failed:", err); root.innerHTML=`<div class="panel">Could not load tournaments.</div>`; }
  }

  async function handleCreateTeam(){
    if(!state.supabase) return toast("Supabase is not configured yet.");
    const name=qs("#teamName")?.value?.trim(), description=qs("#teamDescription")?.value?.trim()||"", region=qs("#teamRegion")?.value?.trim()||"", rankTarget=qs("#teamRankTarget")?.value?.trim()||"", roleNeeded=qs("#teamRoleNeeded")?.value?.trim()||"Any";
    if(!name) return toast("Enter team name.");
    if(!region) return toast("Select region.");
    try{
      const { data:sessionData, error:sessionError } = await state.supabase.auth.getSession();
      if(sessionError) throw sessionError;
      const user=sessionData?.session?.user;
      if(!user) return toast("Please log in first.");
      let payload={ created_by:user.id, name, description, region, rank_target:rankTarget, role_needed:roleNeeded, status:"Recruiting" };
      let { error } = await state.supabase.from("teams").insert(payload);
      if(error && /rank_target/i.test(error.message||"")){ delete payload.rank_target; ({ error } = await state.supabase.from("teams").insert(payload)); }
      if(error && /role_needed/i.test(error.message||"")){ delete payload.role_needed; ({ error } = await state.supabase.from("teams").insert(payload)); }
      if(error) throw error;
      ["#teamName","#teamDescription","#teamRegion","#teamRankTarget","#teamRoleNeeded"].forEach(sel=>{ const el=qs(sel); if(el) el.value=""; });
      closeTeamModal(); await loadTeams(); switchView("teams"); toast("Team created.");
    }catch(err){ console.error("Create team failed:", err); toast(err.message || "Could not create team."); }
  }

  async function handleDeleteTeam(){
    if(!state.supabase || !state.deleteTeamId) return;
    try{
      const { error } = await state.supabase.from("teams").delete().eq("id", state.deleteTeamId);
      if(error) throw error;
      closeDeleteTeamModal(); await loadTeams(); toast("Team deleted.");
    }catch(err){ console.error("Delete team failed:", err); toast(err.message || "Could not delete team."); }
  }

  async function handleCreatePost(){
    if(!state.supabase) return toast("Supabase is not configured yet.");
    const title=qs("#postTitle")?.value?.trim()||"", content=qs("#postContent")?.value?.trim()||"";
    if(!content) return toast("Write something for the post.");
    try{
      const { data:sessionData, error:sessionError } = await state.supabase.auth.getSession();
      if(sessionError) throw sessionError;
      const user=sessionData?.session?.user;
      if(!user) return toast("Please log in first.");
      let payload={ created_by:user.id, title, content };
      let { error } = await state.supabase.from("posts").insert(payload);
      if(error && /title/i.test(error.message||"")){ payload={ created_by:user.id, content }; ({ error } = await state.supabase.from("posts").insert(payload)); }
      if(error) throw error;
      if(qs("#postTitle")) qs("#postTitle").value="";
      if(qs("#postContent")) qs("#postContent").value="";
      closePostModal(); await loadPosts(); switchView("posts"); toast("Post published.");
    }catch(err){ console.error("Create post failed:", err); toast(err.message || "Could not create post."); }
  }

  async function handleDeletePost(){
    if(!state.supabase || !state.deletePostId) return;
    try{
      const { error } = await state.supabase.from("posts").delete().eq("id", state.deletePostId);
      if(error) throw error;
      closeDeletePostModal(); await loadPosts(); toast("Post deleted.");
    }catch(err){ console.error("Delete post failed:", err); toast(err.message || "Could not delete post."); }
  }

  async function handleCreateTournament(){
    if(!state.supabase) return toast("Supabase is not configured yet.");
    const name=qs("#tournamentName")?.value?.trim()||"", description=qs("#tournamentDescription")?.value?.trim()||"", region=qs("#tournamentRegion")?.value?.trim()||"", startDate=qs("#tournamentStart")?.value||null;
    if(!name) return toast("Enter tournament name.");
    if(!region) return toast("Select region.");
    try{
      const { data:sessionData, error:sessionError } = await state.supabase.auth.getSession();
      if(sessionError) throw sessionError;
      const user=sessionData?.session?.user;
      if(!user) return toast("Please log in first.");
      let payload={ created_by:user.id, name, description, region, start_date:startDate };
      let { error } = await state.supabase.from("tournaments").insert(payload);
      if(error && /description/i.test(error.message||"")){ delete payload.description; ({ error } = await state.supabase.from("tournaments").insert(payload)); }
      if(error) throw error;
      ["#tournamentName","#tournamentDescription","#tournamentRegion","#tournamentStart"].forEach(sel=>{ const el=qs(sel); if(el) el.value=""; });
      closeTournamentModal(); await loadTournaments(); switchView("tournaments"); toast("Tournament created.");
    }catch(err){ console.error("Create tournament failed:", err); toast(err.message || "Could not create tournament."); }
  }

  async function handleDeleteTournament(){
    if(!state.supabase || !state.deleteTournamentId) return;
    try{
      const { error } = await state.supabase.from("tournaments").delete().eq("id", state.deleteTournamentId);
      if(error) throw error;
      closeDeleteTournamentModal(); await loadTournaments(); toast("Tournament deleted.");
    }catch(err){ console.error("Delete tournament failed:", err); toast(err.message || "Could not delete tournament."); }
  }

  function bindAuthFlow(){
    qsa("[data-open-auth]").forEach(btn=>btn.addEventListener("click",()=>openAuth(btn.dataset.openAuth)));
    const closeBtn=qs("#closeAuthModal"); if(closeBtn) closeBtn.addEventListener("click", closeAuth);
    const submitBtn=qs("#submitAuthBtn"); if(submitBtn) submitBtn.addEventListener("click", handleEmailAuth);
    const googleBtn=qs("#googleBtn"); if(googleBtn) googleBtn.addEventListener("click", handleGoogleAuth);
    const riotBtn=qs("#riotBtn"); if(riotBtn) riotBtn.addEventListener("click", ()=>toast("Riot sign-in is coming soon."));
  }

  function bindNav(){ qsa(".rail-item").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.view))); }

  function bindDetails(){
    qsa(".entity-card.clickable").forEach(card=>{
      card.addEventListener("click",(e)=>{
        if(e.target.closest(".team-report-btn") || e.target.closest(".delete-team-btn") || e.target.closest(".delete-post-btn") || e.target.closest(".delete-tournament-btn")) return;
        openDetail(card.dataset.detailType, card.dataset.name, card.dataset.meta);
      });
    });
  }

  function bindQuickActions(){
    const a=qs("#createTeamQuickBtn"); if(a) a.addEventListener("click", openTeamModal);
    const b=qs("#createTeamBtn"); if(b) b.addEventListener("click", openTeamModal);
    const c=qs("#createPostBtn"); if(c) c.addEventListener("click", openPostModal);
    const d=qs("#createTournamentBtn"); if(d) d.addEventListener("click", openTournamentModal);
    const e=qs("#newPostQuickBtn"); if(e) e.addEventListener("click", openPostModal);
    const f=qs("#joinTournamentQuickBtn"); if(f) f.addEventListener("click", openTournamentModal);
    const g=qs("#openNotificationsBtn"); if(g) g.addEventListener("click", ()=>toast("Notifications panel coming soon."));
    const h=qs("#openProfileBtn"); if(h) h.addEventListener("click", ()=>switchView("settings"));
  }

  function bindReportFlow(){
    const a=qs("#openReportBtn"); if(a) a.addEventListener("click", ()=>openReport({ type:"general", id:"manual" }));
    const b=qs("#closeReportModal"); if(b) b.addEventListener("click", closeReport);
    const c=qs("#cancelReportBtn"); if(c) c.addEventListener("click", closeReport);
    const d=qs("#submitReportBtn"); if(d) d.addEventListener("click", submitReport);
    qsa(".team-report-btn").forEach(btn=>btn.addEventListener("click",(e)=>{ e.stopPropagation(); openReport({ type:"team", id:btn.dataset.id || "team-card" }); }));
    qsa(".tag").forEach(tag=>tag.addEventListener("click",()=>{ const body=qs("#reportBody"); if(body && !body.value.trim()) body.value=tag.textContent.trim(); }));
  }

  function bindDetailModal(){
    const a=qs("#closeDetailModal"); if(a) a.addEventListener("click", closeDetail);
    const b=qs("#closeDetailBtn"); if(b) b.addEventListener("click", closeDetail);
  }

  function bindTeamFlow(){
    const a=qs("#closeTeamModal"); if(a) a.addEventListener("click", closeTeamModal);
    const b=qs("#cancelTeamBtn"); if(b) b.addEventListener("click", closeTeamModal);
    const c=qs("#saveTeamBtn"); if(c) c.addEventListener("click", handleCreateTeam);
    const d=qs("#closeDeleteTeamModal"); if(d) d.addEventListener("click", closeDeleteTeamModal);
    const e=qs("#cancelDeleteTeamBtn"); if(e) e.addEventListener("click", closeDeleteTeamModal);
    const f=qs("#confirmDeleteTeamBtn"); if(f) f.addEventListener("click", handleDeleteTeam);
  }

  function bindPostFlow(){
    const a=qs("#closePostModal"); if(a) a.addEventListener("click", closePostModal);
    const b=qs("#cancelPostBtn"); if(b) b.addEventListener("click", closePostModal);
    const c=qs("#savePostBtn"); if(c) c.addEventListener("click", handleCreatePost);
    const d=qs("#closeDeletePostModal"); if(d) d.addEventListener("click", closeDeletePostModal);
    const e=qs("#cancelDeletePostBtn"); if(e) e.addEventListener("click", closeDeletePostModal);
    const f=qs("#confirmDeletePostBtn"); if(f) f.addEventListener("click", handleDeletePost);
  }

  function bindTournamentFlow(){
    const a=qs("#closeTournamentModal"); if(a) a.addEventListener("click", closeTournamentModal);
    const b=qs("#cancelTournamentBtn"); if(b) b.addEventListener("click", closeTournamentModal);
    const c=qs("#saveTournamentBtn"); if(c) c.addEventListener("click", handleCreateTournament);
    const d=qs("#closeDeleteTournamentModal"); if(d) d.addEventListener("click", closeDeleteTournamentModal);
    const e=qs("#cancelDeleteTournamentBtn"); if(e) e.addEventListener("click", closeDeleteTournamentModal);
    const f=qs("#confirmDeleteTournamentBtn"); if(f) f.addEventListener("click", handleDeleteTournament);
  }

  function bindTeamCardButtons(){
    qsa(".delete-team-btn").forEach(btn=>btn.addEventListener("click",(e)=>{ e.stopPropagation(); openDeleteTeamModal(btn.dataset.id, btn.dataset.name); }));
    qsa(".team-report-btn").forEach(btn=>btn.addEventListener("click",(e)=>{ e.stopPropagation(); openReport({ type:"team", id:btn.dataset.id || "team-card" }); }));
  }

  function bindPostCardButtons(){
    qsa(".delete-post-btn").forEach(btn=>btn.addEventListener("click",(e)=>{ e.stopPropagation(); openDeletePostModal(btn.dataset.id, btn.dataset.title); }));
  }

  function bindTournamentCardButtons(){
    qsa(".delete-tournament-btn").forEach(btn=>btn.addEventListener("click",(e)=>{ e.stopPropagation(); openDeleteTournamentModal(btn.dataset.id, btn.dataset.name); }));
  }

  function bindLogout(){
    const logoutBtn=qs("#logoutBtn"); if(!logoutBtn) return;
    logoutBtn.addEventListener("click", async (e)=>{
      e.preventDefault();
      try{
        if(state.supabase){
          const { error } = await state.supabase.auth.signOut({ scope:"global" });
          if(error) throw error;
        }
      }catch(err){ console.error("Logout failed:", err); toast(err.message || "Logout failed."); }
      finally{
        try{ localStorage.clear(); }catch{}
        try{ sessionStorage.clear(); }catch{}
        setLoggedIn(false); closeAuth(); window.location.href=window.location.origin;
      }
    });
  }

  async function init(){
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
    bindPostFlow();
    bindTournamentFlow();
    bindLogout();

    const oauthTouched = await restoreOAuthSessionIfNeeded();
    let hasSession = await syncSession();
    if(!hasSession && oauthTouched){
      await new Promise(resolve=>setTimeout(resolve,700));
      await syncSession();
    }

    await loadTeams();
    await loadPosts();
    await loadTournaments();

    if(state.supabase){
      state.supabase.auth.onAuthStateChange(async (_event, session)=>{
        if(session?.user){ setLoggedIn(true, session.user); closeAuth(); }
        else { setLoggedIn(false); }
        await loadTeams();
        await loadPosts();
        await loadTournaments();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once:true });
})();
