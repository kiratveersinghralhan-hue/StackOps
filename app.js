(() => {
  const state = {
    loggedIn: false,
    authMode: "signin",
  };

  const qs = (s, p=document) => p.querySelector(s);
  const qsa = (s, p=document) => Array.from(p.querySelectorAll(s));

  function show(el){ if(el) el.classList.remove("hidden"); }
  function hide(el){ if(el) el.classList.add("hidden"); }

  function setLoggedIn(flag){
    state.loggedIn = flag;
    const guestHome = qs("#guestHome");
    const appShell = qs("#appShell");
    const guestActions = qs("#guestActions");
    const userActions = qs("#userActions");

    if(flag){
      hide(guestHome);
      show(appShell);
      appShell.classList.add("ready");
      hide(guestActions);
      show(userActions);
    } else {
      show(guestHome);
      hide(appShell);
      show(guestActions);
      hide(userActions);
    }
  }

  function openAuth(mode="signin"){
    state.authMode = mode;
    const authModal = qs("#authModal");
    const authTitle = qs("#authTitle");
    if(authTitle) authTitle.textContent = mode === "signup" ? "Create account" : "Sign in";
    show(authModal);
  }
  function closeAuth(){ hide(qs("#authModal")); }

  function openReport(){ show(qs("#reportModal")); }
  function closeReport(){ hide(qs("#reportModal")); }

  function openDetail(type, name, meta){
    const detail = qs("#detailModal");
    qs("#detailType").textContent = `${String(type || "detail").toUpperCase()} VIEW`;
    qs("#detailName").textContent = name || "Item";
    qs("#detailMeta").textContent = meta || "";
    show(detail);
  }
  function closeDetail(){ hide(qs("#detailModal")); }

  function bindNav(){
    qsa(".rail-item").forEach(btn => {
      btn.addEventListener("click", () => {
        qsa(".rail-item").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const view = btn.dataset.view;
        qsa(".view").forEach(v => v.classList.remove("active"));
        const panel = qs(`#view-${view}`);
        if(panel) panel.classList.add("active");
        const title = qs("#viewTitle");
        if(title) title.textContent = btn.textContent.trim();
      });
    });
  }

  function bindDetails(){
    qsa(".entity-card.clickable").forEach(card => {
      card.addEventListener("click", (e) => {
        if(e.target.closest(".team-report-btn")) return;
        openDetail(card.dataset.detailType, card.dataset.name, card.dataset.meta);
      });
    });
  }

  function bindTeamReportButtons(){
    qsa(".team-report-btn").forEach(btn => btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openReport();
    }));
  }

  function bindAvatarUpload(){
    const input = qs("#avatarInput");
    const preview = qs("#avatarPreview");
    const genBtn = qs("#generateAvatarBtn");
    if(input && preview){
      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = e => preview.src = e.target.result;
        reader.readAsDataURL(file);
      });
    }
    if(genBtn && preview){
      genBtn.addEventListener("click", () => {
        const colors = ["#8fe8ff","#f0d56f","#7fd1ff","#9effc2"];
        const c = colors[Math.floor(Math.random()*colors.length)];
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><rect width='100%' height='100%' rx='42' fill='#081326'/><circle cx='128' cy='96' r='42' fill='${c}'/><rect x='58' y='154' width='140' height='56' rx='28' fill='${c}' opacity='.9'/></svg>`;
        preview.src = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
      });
    }
  }

  function bindAuthFlow(){
    qsa("[data-open-auth]").forEach(btn => btn.addEventListener("click", () => openAuth(btn.dataset.openAuth)));
    const closeBtn = qs("#closeAuthModal");
    if(closeBtn) closeBtn.addEventListener("click", closeAuth);
    const submit = qs("#submitAuthBtn");
    if(submit){
      submit.addEventListener("click", () => {
        setLoggedIn(true);    // Keep your real auth hook here
        closeAuth();
      });
    }
    const googleBtn = qs("#googleBtn");
    if(googleBtn){
      googleBtn.addEventListener("click", () => {
        alert("Enable Google provider in Supabase, then wire your current oauth call here.");
      });
    }
    const riotBtn = qs("#riotBtn");
    if(riotBtn){
      riotBtn.addEventListener("click", () => {
        alert("Riot sign-in needs Riot OAuth approval and credentials. Keep this as coming soon until configured.");
      });
    }
  }

  function bindReportFlow(){
    const closeBtn = qs("#closeReportModal");
    const cancelBtn = qs("#cancelReportBtn");
    const openBtn = qs("#openReportBtn");
    if(openBtn) openBtn.addEventListener("click", openReport);
    if(closeBtn) closeBtn.addEventListener("click", closeReport);
    if(cancelBtn) cancelBtn.addEventListener("click", closeReport);
  }

  function bindDetailModal(){
    const closeA = qs("#closeDetailModal");
    const closeB = qs("#closeDetailBtn");
    if(closeA) closeA.addEventListener("click", closeDetail);
    if(closeB) closeB.addEventListener("click", closeDetail);
  }

  function bindLogout(){
    const btn = qs("#logoutBtn");
    if(btn) btn.addEventListener("click", () => setLoggedIn(false));
  }

  function initIntro(){
    const intro = qs("#introScreen");
    if(!intro) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dwell = reduce ? 1200 : 3000;
    window.addEventListener("load", () => {
      setTimeout(() => {
        intro.classList.add("hide");
        setTimeout(() => intro.remove(), 1200);
      }, dwell);
    });
  }

  function init(){
    initIntro();
    bindAuthFlow();
    bindNav();
    bindDetails();
    bindTeamReportButtons();
    bindAvatarUpload();
    bindReportFlow();
    bindDetailModal();
    bindLogout();
    // default guest state; replace this with your current session check
    setLoggedIn(false);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
