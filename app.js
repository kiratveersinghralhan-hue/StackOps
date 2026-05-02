(() => {
  const cfg = window.STACKOPS_CONFIG || {};
  const $ = (s, p=document) => p.querySelector(s);
  const $$ = (s, p=document) => [...p.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const state = { user:null, supabase:null, profiles:[], squads:[], posts:[], events:[] };

  const demo = {
    profiles:[
      {id:'p1', username:'NeonArc', rank:'Ascendant', main_agent:'Jett / Reyna', region:'Mumbai', language:'Hindi + English', bio:'Aggressive entry, chill comms, serious ranked grind.'},
      {id:'p2', username:'CipherNova', rank:'Diamond', main_agent:'Cypher', region:'Delhi', language:'English', bio:'Sentinel main. Looking for disciplined 5-stack.'},
      {id:'p3', username:'SageFlux', rank:'Platinum', main_agent:'Sage / Skye', region:'Bangalore', language:'Hindi + Kannada', bio:'Support player, positive vibes, late-night queues.'},
      {id:'p4', username:'ViperByte', rank:'Immortal', main_agent:'Viper', region:'APAC', language:'English', bio:'Controller. Scrims, tourneys, vod review.'},
      {id:'p5', username:'OmenKage', rank:'Gold', main_agent:'Omen', region:'Pune', language:'Hindi', bio:'Weekend gamer. Need friends to queue.'},
      {id:'p6', username:'RadiantRift', rank:'Radiant', main_agent:'Raze', region:'Singapore', language:'English', bio:'Creator, coach, tournament host.'}
    ],
    squads:[
      {id:'s1', name:'Pulse Vector', game:'Valorant', looking_for:'Controller needed', description:'Evening ranked stack. APAC. Mic required.'},
      {id:'s2', name:'Midnight Stack', game:'Valorant', looking_for:'IGL + Sentinel', description:'Serious but non-toxic. 9 PM IST daily.'},
      {id:'s3', name:'Rift Syndicate', game:'League / Valorant', looking_for:'Creators', description:'Multi-Riot community for content and casual games.'}
    ],
    posts:[
      {id:'f1', title:'Need duo for Ascendant push', body:'Mumbai server, comms on, no toxicity. Tonight 8 PM IST.'},
      {id:'f2', title:'Clip drop: 1v4 clutch', body:'Add reactions, comments and clip upload with Supabase Storage later.'},
      {id:'f3', title:'Team recruitment open', body:'Pulse Vector needs Controller and secondary Initiator.'}
    ],
    events:[
      {id:'e1', name:'Night Ops Cup', date:'Friday 8 PM IST', prize:'₹5,000 prize pool', description:'16 teams, single elimination, entry fee supported.'},
      {id:'e2', name:'Creator Scrim Block', date:'Saturday 7 PM IST', prize:'Sponsor slots', description:'Paid team promotion + stream partnership option.'}
    ]
  };

  function toast(msg){ const host=$('#toast'); const el=document.createElement('div'); el.className='toast'; el.textContent=msg; host.appendChild(el); setTimeout(()=>el.remove(),2600); }
  function initSupabase(){ if(window.supabase && cfg.supabaseUrl && cfg.supabaseAnonKey){ state.supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey); } }
  async function loadTable(name, fallback){
    if(!state.supabase) return fallback;
    try{ const {data,error}=await state.supabase.from(cfg.tables[name]).select('*').order('created_at',{ascending:false}); if(error) throw error; return data?.length ? data : fallback; }
    catch(e){ console.warn('Supabase table load failed:', name, e.message); return fallback; }
  }
  async function insertTable(name, payload, fallbackKey){
    payload.created_at = new Date().toISOString();
    if(state.user?.id) payload.user_id = state.user.id;
    if(state.supabase){
      try{ const {data,error}=await state.supabase.from(cfg.tables[name]).insert(payload).select().single(); if(error) throw error; return data; }
      catch(e){ console.warn('Supabase insert failed:', e.message); if(!cfg.demoModeWhenSupabaseFails) throw e; }
    }
    const row = {...payload, id: crypto.randomUUID ? crypto.randomUUID() : Date.now()}; demo[fallbackKey].unshift(row); return row;
  }
  async function refresh(){
    [state.profiles,state.squads,state.posts,state.events] = await Promise.all([
      loadTable('profiles', demo.profiles), loadTable('squads', demo.squads), loadTable('posts', demo.posts), loadTable('events', demo.events)
    ]);
    renderAll();
  }

  function playerCard(p){ return `<article class="card" data-detail='${esc(JSON.stringify(p))}'><div class="avatar">${esc((p.username||'?').slice(0,2).toUpperCase())}</div><h3>${esc(p.username)}</h3><p>${esc(p.bio||'Ready to queue.')}</p><div><span class="chip">${esc(p.rank||'Unranked')}</span><span class="chip">${esc(p.main_agent||'Flex')}</span><span class="chip">${esc(p.region||'Global')}</span><span class="chip">${esc(p.language||'Any language')}</span></div><div class="card-actions"><button class="btn ghost mini" data-invite="${esc(p.username)}">Invite</button><button class="btn ghost mini" data-panel="profile">View</button></div></article>`; }
  function squadCard(s){ return `<article class="card"><div class="avatar">${esc((s.name||'SQ').slice(0,2).toUpperCase())}</div><h3>${esc(s.name)}</h3><p>${esc(s.description||'Squad is recruiting.')}</p><span class="chip">${esc(s.game||'Valorant')}</span><span class="chip">${esc(s.looking_for||'Open roles')}</span><div class="card-actions"><button class="btn ghost mini" data-panel="squad">Request join</button><button class="btn ghost mini">Share</button></div></article>`; }
  function postCard(p){ return `<article class="post"><p class="eyebrow">COMMUNITY POST</p><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p><div class="card-actions"><button class="btn ghost mini">Like</button><button class="btn ghost mini">Comment</button><button class="btn ghost mini">Boost</button></div></article>`; }
  function eventCard(e){ return `<article class="card"><div class="avatar">EV</div><h3>${esc(e.name)}</h3><p>${esc(e.description)}</p><span class="chip">${esc(e.date||'TBA')}</span><span class="chip">${esc(e.prize||'Prize TBA')}</span><div class="card-actions"><button class="btn ghost mini">Register</button><button class="btn ghost mini">Sponsor</button></div></article>`; }
  function renderAll(){
    const q = ($('#playerSearch')?.value || '').toLowerCase(), r = $('#rankFilter')?.value || '';
    const players = state.profiles.filter(p => (!r || (p.rank||'')===r) && JSON.stringify(p).toLowerCase().includes(q));
    $('#playersGrid').innerHTML = players.map(playerCard).join('') || '<p>No players found.</p>';
    $('#squadsGrid').innerHTML = state.squads.map(squadCard).join('');
    $('#feedList').innerHTML = state.posts.map(postCard).join('');
    $('#eventsGrid').innerHTML = state.events.map(eventCard).join('');
    $('#statPlayers').textContent = state.profiles.length; $('#statSquads').textContent = state.squads.length;
  }
  function openPage(id){ $$('.page').forEach(p=>p.classList.toggle('active',p.id===id)); $$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===id)); window.scrollTo({top:0,behavior:'smooth'}); }
  function openPanel(title, html){ $('#panelBody').innerHTML = `<p class="eyebrow">STACKOPS DETAIL</p><h2>${esc(title)}</h2>${html}`; $('#sidePanel').classList.add('open'); }

  async function auth(type){
    if(!state.supabase) return toast('Supabase client not available. Check config.js and internet connection.');
    const email=$('#email').value.trim(), password=$('#password').value; if(!email||!password) return toast('Enter email and password.');
    const method = type==='signup' ? state.supabase.auth.signUp.bind(state.supabase.auth) : state.supabase.auth.signInWithPassword.bind(state.supabase.auth);
    const {data,error}=await method({email,password}); if(error) return toast(error.message); state.user=data.user || data.session?.user; $('#authBtn').textContent=state.user?.email || 'Account'; $('#authModal').close(); toast(type==='signup'?'Account created':'Signed in');
  }
  function bind(){
    $$('[data-nav]').forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.nav)));
    $$('[data-open]').forEach(b=>b.addEventListener('click',()=>$('#'+b.dataset.open).showModal()));
    $('#authBtn').addEventListener('click',()=>$('#authModal').showModal()); $('#signin').addEventListener('click',()=>auth('signin')); $('#signup').addEventListener('click',()=>auth('signup'));
    $('#closePanel').addEventListener('click',()=>$('#sidePanel').classList.remove('open'));
    $('#themeBtn').addEventListener('click',()=>{ document.body.classList.toggle('hyper'); toast('Pulse mode toggled'); });
    $('#playerSearch').addEventListener('input',renderAll); $('#rankFilter').addEventListener('change',renderAll);
    document.addEventListener('click', e=>{
      const inv=e.target.closest('[data-invite]'); if(inv){ $('#inviteModal').showModal(); $('[name="note"]','#inviteForm').value=`Yo ${inv.dataset.invite}, want to queue?`; }
      const card=e.target.closest('[data-detail]'); if(card && !e.target.closest('button')){ const p=JSON.parse(card.dataset.detail); openPanel(p.username, `<p>${esc(p.bio)}</p><p><b>Rank:</b> ${esc(p.rank)}<br><b>Main:</b> ${esc(p.main_agent)}<br><b>Region:</b> ${esc(p.region)}</p><button class="btn" data-open="inviteModal">Invite to play</button>`); }
      const panel=e.target.closest('[data-panel]'); if(panel) openPanel('Social action', '<p>This is ready for Supabase-backed friend requests, DMs, squad requests and notifications.</p>');
    });
    $('#profileForm').addEventListener('submit',async e=>{e.preventDefault(); const row=Object.fromEntries(new FormData(e.target)); await insertTable('profiles',row,'profiles'); e.target.closest('dialog').close(); toast('Profile saved'); await refresh();});
    $('#squadForm').addEventListener('submit',async e=>{e.preventDefault(); const row=Object.fromEntries(new FormData(e.target)); await insertTable('squads',row,'squads'); e.target.closest('dialog').close(); toast('Squad created'); await refresh();});
    $('#postForm').addEventListener('submit',async e=>{e.preventDefault(); const row=Object.fromEntries(new FormData(e.target)); await insertTable('posts',row,'posts'); e.target.closest('dialog').close(); toast('Post published'); await refresh();});
    $('#eventForm').addEventListener('submit',async e=>{e.preventDefault(); const row=Object.fromEntries(new FormData(e.target)); await insertTable('events',row,'events'); e.target.closest('dialog').close(); toast('Event created'); await refresh();});
    $('#inviteForm').addEventListener('submit',async e=>{e.preventDefault(); const row=Object.fromEntries(new FormData(e.target)); await insertTable('invites',row,'invites'); e.target.closest('dialog').close(); toast('Invite created');});
  }
  function particles(){
    const c=$('#fxCanvas'), ctx=c.getContext('2d'); let pts=[]; function resize(){c.width=innerWidth;c.height=innerHeight;pts=Array.from({length:Math.min(90,Math.floor(innerWidth/18))},()=>({x:Math.random()*c.width,y:Math.random()*c.height,vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35}));} resize(); addEventListener('resize',resize);
    function tick(){ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='rgba(93,244,255,.7)';ctx.strokeStyle='rgba(93,244,255,.09)';pts.forEach((p,i)=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>c.width)p.vx*=-1;if(p.y<0||p.y>c.height)p.vy*=-1;ctx.beginPath();ctx.arc(p.x,p.y,1.3,0,7);ctx.fill();for(let j=i+1;j<pts.length;j++){const q=pts[j],d=Math.hypot(p.x-q.x,p.y-q.y);if(d<120){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}}});requestAnimationFrame(tick);} tick();
  }
  async function boot(){ initSupabase(); particles(); bind(); setTimeout(()=>$('#boot').classList.add('hide'),1500); if(state.supabase){ const {data}=await state.supabase.auth.getSession(); state.user=data?.session?.user || null; if(state.user) $('#authBtn').textContent=state.user.email; } await refresh(); }
  boot();
})();
