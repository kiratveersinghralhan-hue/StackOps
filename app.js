
(() => {
  const cfg = window.STACKOPS_CONFIG || {};
  let supabase = null;

  const qs = (s) => document.querySelector(s);

  function show(el){ if(el){ el.style.display=""; }}
  function hide(el){ if(el){ el.style.display="none"; }}
  function toast(m){ alert(m); }

  function initSupabase(){
    if(window.supabase && cfg.supabaseUrl && cfg.supabaseAnonKey){
      supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    }
  }

  async function sync(){
    if(!supabase) return;
    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user;

    if(user){
      hide(qs("#guestHome"));
      show(qs("#appShell"));
      qs("#openProfileBtn").textContent = user.email;
    } else {
      show(qs("#guestHome"));
      hide(qs("#appShell"));
    }
  }

  async function emailAuth(mode){
    const email = qs("#authEmail").value.trim();
    const pass = qs("#authPassword").value;

    if(!email || !pass) return toast("Enter email and password");

    if(mode==="signup"){
      const { error } = await supabase.auth.signUp({ email, password:pass });
      if(error && error.message.includes("already")){
        await supabase.auth.signInWithPassword({ email, password:pass });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password:pass });
      if(error) return toast(error.message);
    }

    await sync();
    hide(qs("#authModal"));
  }

  async function google(){
    await supabase.auth.signInWithOAuth({
      provider:"google",
      options:{ redirectTo: window.location.origin }
    });
  }

  function bind(){
    document.querySelectorAll("[data-open-auth]").forEach(b=>{
      b.onclick=()=>show(qs("#authModal"));
    });

    qs("#submitAuthBtn").onclick = ()=>emailAuth("signin");
    qs("#googleBtn").onclick = google;

    qs("#logoutBtn").onclick = async ()=>{
      await supabase.auth.signOut();
      location.reload();
    };

    qs("#closeAuthModal").onclick = ()=>hide(qs("#authModal"));
  }

  async function init(){
    initSupabase();
    bind();
    await sync();

    if(supabase){
      supabase.auth.onAuthStateChange(()=>sync());
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
