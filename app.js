const cfg = window.STACKOPS_CONFIG || {};
const hasSupabase = cfg.SUPABASE_URL && cfg.SUPABASE_URL !== 'YOUR_SUPABASE_URL' && cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
const sb = hasSupabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
let currentUser = null;
let profile = null;

const demo = {
  profiles: [
    {id:'demo1', username:'astra.admin', display_name:'Founder Admin', title:'Founder 👑', badge:'Admin Crown', role:'admin', account_status:'approved', is_verified:true},
    {id:'demo2', username:'jettdash', display_name:'JettDash', title:'Radiant Entry', badge:'Diamond Badge', role:'user', account_status:'approved', is_verified:true},
    {id:'demo3', username:'sageflow', display_name:'SageFlow', title:'Clutch Mentor', badge:'Gold Badge', role:'user', account_status:'pending', is_verified:false}
  ],
  squads: [
    {id:'s1', name:'Mumbai Night Queue', game:'Valorant', region:'Asia', rank_required:'Silver-Gold', description:'Chill comms, no toxicity, comp grind.'},
    {id:'s2', name:'Ascendant Aim Lab', game:'Valorant', region:'Asia', rank_required:'Ascendant+', description:'Serious team for scrims and VOD review.'},
    {id:'s3', name:'Swiftplay Socials', game:'Valorant', region:'EU', rank_required:'Any rank', description:'Make friends, clips, casual games.'}
  ],
  services: [
    {id:'v1', title:'Valorant VOD Review', description:'Detailed round-by-round review, mistakes and drills.', price_inr:799, status:'approved', category:'coaching'},
    {id:'v2', title:'Aim + Crosshair Coaching', description:'One hour custom routine and sensitivity check.', price_inr:499, status:'approved', category:'coaching'},
    {id:'v3', title:'Profile Verification Help', description:'Help creators set up verified profile and media kit.', price_inr:999, status:'pending', category:'verification'}
  ],
  orders: [
    {id:'o1', amount_inr:4999, status:'paid', plan_key:'diamond', platform_commission_inr:750},
    {id:'o2', amount_inr:799, status:'pending', plan_key:null, platform_commission_inr:120}
  ],
  plans: [
    {plan_key:'free', name:'Free', price_inr:0, badge:'Starter', title:'Rookie', perks:['Basic profile','Join squads','Public feed']},
    {plan_key:'silver', name:'Silver', price_inr:499, badge:'Silver Badge', title:'Rising Gamer', perks:['Silver badge','More invites','Profile theme']},
    {plan_key:'gold', name:'Gold', price_inr:1499, badge:'Gold Badge', title:'Elite Player', perks:['Animated title','Discovery boost','Service listing']},
    {plan_key:'diamond', name:'Diamond', price_inr:4999, badge:'Diamond Badge', title:'Pro Grinder', perks:['Premium profile','Featured listing','Priority matchmaking']},
    {plan_key:'legend', name:'Legend', price_inr:10000, badge:'Crown Badge', title:'StackOps Legend', perks:['Crown badge','Top boost','VIP support','Founder wall']}
  ],
  messages: [
    {id:'m1', content:'Need 2 for comp. Gold/Plat Asia.', sender_name:'JettDash'},
    {id:'m2', content:'Coach available for VOD review today.', sender_name:'SageFlow'}
  ]
};

const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));
const toast = (msg) => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600); };
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const safe = (v) => String(v ?? '').replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));

window.addEventListener('load', async () => {
  setTimeout(() => $('#intro')?.classList.add('done'), 1250);
  bindActions();
  route(location.hash.replace('#','') || 'home');
  await init();
});
window.addEventListener('hashchange', () => route(location.hash.replace('#','') || 'home'));

function bindActions(){
  document.body.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action],[data-route]');
    if(!el) return;
    if(el.dataset.route){ route(el.dataset.route); location.hash = el.dataset.route; return; }
    const a = el.dataset.action;
    if(a === 'toggleNav') $('#nav').classList.toggle('open');
    if(a === 'openAuth') openModal('authModal');
    if(a === 'closeModals') closeModals();
    if(a === 'signIn') signIn();
    if(a === 'signUp') signUp();
    if(a === 'refreshAll') loadAll();
    if(a === 'quickMatch') quickMatch();
    if(a === 'openSquadModal') requireLogin(()=>openModal('squadModal'));
    if(a === 'openServiceModal') requireLogin(()=>openModal('serviceModal'));
    if(a === 'createSquad') createSquad();
    if(a === 'createService') createService();
    if(a === 'sendMessage') sendMessage();
    if(a === 'refreshChat') loadChat();
    if(a === 'loadAdmin') loadAdmin();
    if(a === 'buyPlan') buyPlan(el.dataset.plan, Number(el.dataset.price));
    if(a === 'bookService') bookService(el.dataset.id, Number(el.dataset.price));
    if(a === 'adminUser') adminUser(el.dataset.id, el.dataset.op);
    if(a === 'adminService') adminService(el.dataset.id, el.dataset.op);
  });
}
function route(name){
  $$('.page').forEach(p=>p.classList.remove('active-page'));
  $(`#${name}`)?.classList.add('active-page');
  $$('.nav a').forEach(a=>a.classList.toggle('active', a.dataset.route === name));
  if(name === 'admin') loadAdmin();
  if(name === 'chat') loadChat();
}
function openModal(id){ $(`#${id}`)?.classList.remove('hidden'); }
function closeModals(){ $$('.modal').forEach(m=>m.classList.add('hidden')); }
function requireLogin(fn){ if(!currentUser){ toast('Login first to use this.'); openModal('authModal'); return; } fn(); }

async function init(){
  if(sb){
    const {data} = await sb.auth.getUser(); currentUser = data?.user || null;
    if(currentUser) await loadProfile();
    sb.auth.onAuthStateChange(async (_evt, session)=>{ currentUser = session?.user || null; if(currentUser) await loadProfile(); updateAuthUI(); loadAll(); });
  }
  updateAuthUI();
  await loadAll();
}
async function loadProfile(){
  if(!sb || !currentUser) return;
  let {data} = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
  profile = data;
  if(profile?.role === 'admin') $('.admin-link')?.classList.remove('hidden');
  $('#heroName').textContent = profile?.display_name || profile?.username || 'Founder Lobby';
  $('#heroTitle').textContent = `${profile?.title || 'Rookie'} • ${profile?.badge || 'Starter'}`;
}
function updateAuthUI(){
  const btn = $('.top-actions .ghost');
  if(!btn) return;
  btn.textContent = currentUser ? 'Logout' : 'Login';
  btn.dataset.action = currentUser ? 'logout' : 'openAuth';
  if(currentUser){ btn.onclick = async()=>{ await sb.auth.signOut(); currentUser=null; profile=null; location.hash='home'; toast('Logged out'); }; }
}
async function signIn(){
  if(!sb) return toast('Add Supabase URL + anon key in config.js first.');
  const email=$('#authEmail').value.trim(), password=$('#authPassword').value;
  const {error}=await sb.auth.signInWithPassword({email,password});
  if(error) return toast(error.message);
  closeModals(); toast('Welcome back.');
}
async function signUp(){
  if(!sb) return toast('Add Supabase URL + anon key in config.js first.');
  const email=$('#authEmail').value.trim(), password=$('#authPassword').value;
  const {error}=await sb.auth.signUp({email,password});
  if(error) return toast(error.message);
  closeModals(); toast('Account created. Check email if confirmation is enabled.');
}
async function fetchTable(name, fallback, opts={}){
  if(!sb) return fallback;
  let q = sb.from(name).select('*');
  if(opts.eq) q = q.eq(opts.eq[0], opts.eq[1]);
  if(opts.order) q = q.order(opts.order, {ascending:false});
  const {data,error}=await q.limit(opts.limit || 60);
  if(error){ console.warn(name,error); return fallback; }
  return data || [];
}
async function loadAll(){
  const [profiles,squads,services,plans] = await Promise.all([
    fetchTable('profiles', demo.profiles, {limit:30}),
    fetchTable('squads', demo.squads, {order:'created_at'}),
    fetchTable('services', demo.services, {order:'created_at'}),
    fetchTable('plans', demo.plans)
  ]);
  renderFeed(profiles, services);
  renderSquads(squads);
  renderServices(services);
  renderPlans(plans.length ? plans : demo.plans);
  $('#metricUsers').textContent = profiles.length;
  $('#metricServices').textContent = services.filter(s=>s.status==='approved').length;
}
function renderFeed(profiles, services){
  const approved = profiles.filter(p=>p.account_status === 'approved' || p.role === 'admin').slice(0,6);
  $('#feedGrid').innerHTML = approved.map(p=>`<article class="card"><span class="pill ${p.role==='admin'?'gold':''}">${p.role==='admin'?'👑 Admin':'✓ Player'}</span><h3>${safe(p.display_name || p.username || 'Player')}</h3><p>${safe(p.title || 'Rookie')} • ${safe(p.badge || 'Starter')}</p><div class="card-actions"><button class="glass">Invite</button><button class="ghost">View profile</button></div></article>`).join('') || '<p class="muted">No profiles yet.</p>';
}
function renderSquads(rows){
  const rank=$('#rankFilter')?.value || '', region=$('#regionFilter')?.value || '';
  const filtered = rows.filter(s=>(!rank || s.rank_required===rank || s.rank_required==='Any rank') && (!region || s.region===region));
  $('#squadGrid').innerHTML = filtered.map(s=>`<article class="card"><span class="pill">${safe(s.game || 'Valorant')}</span><h3>${safe(s.name)}</h3><p>${safe(s.description || 'Squad up and play.')}</p><p><b>${safe(s.region || 'Any region')}</b> • ${safe(s.rank_required || 'Any rank')}</p><div class="card-actions"><button class="primary">Request Join</button><button class="glass">Invite Friend</button></div></article>`).join('') || '<p class="muted">No squads found.</p>';
}
function renderServices(rows){
  const visible = rows.filter(s=>s.status === 'approved' || s.owner_id === currentUser?.id || profile?.role === 'admin');
  $('#serviceGrid').innerHTML = visible.map(s=>`<article class="card"><span class="pill ${s.status==='approved'?'':'gold'}">${safe(s.status || 'pending')}</span><h3>${safe(s.title)}</h3><p>${safe(s.description || '')}</p><div class="price">${money(s.price_inr)}</div><small>Platform commission: ${s.commission_percent || cfg.PLATFORM_COMMISSION_PERCENT || 15}%</small><div class="card-actions"><button class="primary" data-action="bookService" data-id="${s.id}" data-price="${s.price_inr}">Book</button><button class="glass">Message coach</button></div></article>`).join('') || '<p class="muted">No services yet.</p>';
}
function renderPlans(rows){
  const order = {free:0,silver:1,gold:2,diamond:3,legend:4};
  rows.sort((a,b)=>(order[a.plan_key]??9)-(order[b.plan_key]??9));
  $('#planGrid').innerHTML = rows.map(p=>`<article class="price-card ${p.plan_key==='legend'?'featured':''}"><span class="pill ${p.plan_key==='legend'?'gold':''}">${safe(p.badge)}</span><h3>${safe(p.name)}</h3><div class="price">${money(p.price_inr)}</div><p>${safe(p.title)}</p><ul>${(Array.isArray(p.perks)?p.perks:JSON.parse(p.perks || '[]')).map(x=>`<li>${safe(x)}</li>`).join('')}</ul><button class="primary full" data-action="buyPlan" data-plan="${p.plan_key}" data-price="${p.price_inr}">${p.price_inr ? 'Upgrade' : 'Current / Start'}</button></article>`).join('');
}
async function createSquad(){
  if(!currentUser) return requireLogin(()=>{});
  const payload={owner_id:currentUser.id,name:$('#squadName').value.trim(),region:$('#squadRegion').value.trim(),rank_required:$('#squadRank').value.trim(),description:$('#squadDesc').value.trim(),game:'Valorant'};
  if(!payload.name) return toast('Squad name required.');
  if(sb){ const {error}=await sb.from('squads').insert(payload); if(error) return toast(error.message); }
  closeModals(); toast('Squad created.'); loadAll();
}
async function createService(){
  if(!currentUser) return requireLogin(()=>{});
  const price = Number($('#servicePrice').value || 0);
  const payload={owner_id:currentUser.id,title:$('#serviceTitle').value.trim(),description:$('#serviceDesc').value.trim(),price_inr:price,commission_percent:cfg.PLATFORM_COMMISSION_PERCENT || 15,status:'pending',game:'Valorant',category:'coaching'};
  if(!payload.title || !price) return toast('Title and price required.');
  if(sb){ const {error}=await sb.from('services').insert(payload); if(error) return toast(error.message); }
  closeModals(); toast('Service submitted for admin approval.'); loadAll();
}
async function buyPlan(plan, price){
  requireLogin(async()=>{
    const commission=0;
    if(sb){ const {error}=await sb.from('orders').insert({buyer_id:currentUser.id,plan_key:plan,amount_inr:price,platform_commission_inr:commission,status:'pending'}); if(error) return toast(error.message); }
    toast('Order created. Connect Razorpay to collect payment and auto-activate.');
  });
}
async function bookService(id, price){
  requireLogin(async()=>{
    const commission = Math.round(price * ((cfg.PLATFORM_COMMISSION_PERCENT || 15)/100));
    if(sb){ const {error}=await sb.from('orders').insert({buyer_id:currentUser.id,service_id:id,amount_inr:price,platform_commission_inr:commission,status:'pending'}); if(error) return toast(error.message); }
    toast('Booking order created. Payment integration next.');
  });
}
async function quickMatch(){
  const squads = await fetchTable('squads', demo.squads);
  const pick = squads[Math.floor(Math.random()*squads.length)];
  toast(pick ? `Matched: ${pick.name}` : 'Create the first squad.');
  location.hash = 'squads';
}
async function loadChat(){
  const rows = await fetchTable('messages', demo.messages, {order:'created_at',limit:80});
  $('#chatMessages').innerHTML = rows.reverse().map(m=>`<div class="msg ${m.sender_id===currentUser?.id?'me':''}"><b>${safe(m.sender_name || 'Player')}</b><br>${safe(m.content)}</div>`).join('');
  const box=$('#chatMessages'); box.scrollTop=box.scrollHeight;
}
async function sendMessage(){
  requireLogin(async()=>{
    const input=$('#chatInput'), content=input.value.trim(); if(!content) return;
    const sender_name = profile?.display_name || profile?.username || currentUser.email?.split('@')[0] || 'Player';
    if(sb){ const {error}=await sb.from('messages').insert({sender_id:currentUser.id,sender_name,content,channel:'global'}); if(error) return toast(error.message); }
    input.value=''; await loadChat();
  });
}
async function loadAdmin(){
  if(hasSupabase && profile?.role !== 'admin'){ toast('Admin only.'); return; }
  const [users,services,orders] = await Promise.all([
    fetchTable('profiles', demo.profiles, {limit:80}), fetchTable('services', demo.services, {limit:80}), fetchTable('orders', demo.orders, {limit:80})
  ]);
  $('#adminUsers').innerHTML = users.map(u=>`<div class="admin-item"><div><b>${safe(u.display_name||u.username||u.id)}</b><br><small>${safe(u.role)} • ${safe(u.account_status)} • ${safe(u.title||'')}</small></div><div class="actions"><button class="glass" data-action="adminUser" data-op="approved" data-id="${u.id}">Approve</button><button class="glass" data-action="adminUser" data-op="verified" data-id="${u.id}">Verify</button><button class="danger" data-action="adminUser" data-op="banned" data-id="${u.id}">Ban</button></div></div>`).join('');
  $('#adminServices').innerHTML = services.map(s=>`<div class="admin-item"><div><b>${safe(s.title)}</b><br><small>${safe(s.status)} • ${money(s.price_inr)}</small></div><div class="actions"><button class="glass" data-action="adminService" data-op="approved" data-id="${s.id}">Approve</button><button class="danger" data-action="adminService" data-op="rejected" data-id="${s.id}">Reject</button></div></div>`).join('');
  $('#adminOrders').innerHTML = orders.map(o=>`<div class="admin-item"><div><b>${money(o.amount_inr)}</b><br><small>${safe(o.status)} • commission ${money(o.platform_commission_inr)}</small></div><div class="actions"><button class="glass">Verify Payment</button></div></div>`).join('');
}
async function adminUser(id, op){
  if(!sb) return toast('Demo mode: add Supabase config to make changes.');
  let patch = {};
  if(op === 'approved') patch={account_status:'approved',is_banned:false};
  if(op === 'verified') patch={is_verified:true,badge:'Verified',title:'Verified Gamer'};
  if(op === 'banned') patch={account_status:'banned',is_banned:true};
  const {error}=await sb.from('profiles').update(patch).eq('id',id);
  if(error) return toast(error.message); toast('User updated.'); loadAdmin(); loadAll();
}
async function adminService(id, op){
  if(!sb) return toast('Demo mode: add Supabase config to make changes.');
  const {error}=await sb.from('services').update({status:op}).eq('id',id);
  if(error) return toast(error.message); toast('Service updated.'); loadAdmin(); loadAll();
}
$('#rankFilter')?.addEventListener('change', loadAll);
$('#regionFilter')?.addEventListener('change', loadAll);
