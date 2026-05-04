import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const CONFIG = window.STACKOPS_CONFIG || {};
const hasSB = CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && !CONFIG.SUPABASE_URL.includes('YOUR_');
const supabase = hasSB ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : null;
const ADMIN_EMAILS = (CONFIG.ADMIN_EMAILS || []).map(e => e.toLowerCase());
const $ = (id) => document.getElementById(id);
const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const today = () => new Date().toISOString().slice(0, 10);
const uid8 = (s) => (s || '').slice(0, 8);
const escapeHtml = (s='') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const rewardIcon = (type, name='') => {
  const n = String(name).toLowerCase();
  if(n.includes('founder') || n.includes('origin')) return '♛';
  if(type === 'title') return 'T';
  if(type === 'badge') return '◆';
  if(type === 'banner') return '▰';
  return '✦';
};
const rewardClass = (name='') => String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'starter';
function identityPreview(profile, mini=false){
  const title = escapeHtml(profile?.equipped_title || 'Rookie');
  const badge = escapeHtml(profile?.equipped_badge || 'First Login');
  const banner = escapeHtml(profile?.equipped_banner || 'Starter Arena');
  const founder = String(title + badge + banner).toLowerCase().includes('founder') || String(badge).toLowerCase().includes('origin');
  return `<div class="identity-preview ${founder?'founder-preview':''} ${mini?'mini-preview':''}">
    <div class="banner-art ${rewardClass(banner)}"><span>${founder?'♛':'✦'}</span><b>${banner}</b></div>
    <div class="identity-row"><div class="title-art"><span>Title</span><b>${title}</b></div><div class="badge-art"><span>${founder?'♛':'◆'}</span><b>${badge}</b></div></div>
  </div>`;
}
function rewardPreview(r){
  return `<div class="reward-preview ${r.admin_only?'founder-preview':''}"><span>${rewardIcon(r.type,r.name)}</span><b>${escapeHtml(r.type || 'item')}</b></div>`;
}

const state = { user:null, profile:null, isAdmin:false, room:'global', selectedService:null, selectedPlan:null, rewards:[], unlocked:new Set(), services:[], adminTab:'seller' };
const local = {
  get(k, fallback=[]){ try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)); } catch { return fallback; } },
  set(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
};
function toast(msg){ const t=$('toast'); if(!t) return alert(msg); t.textContent=msg; t.classList.remove('hidden'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.add('hidden'),3600); }
function err(prefix, e){ console.error(prefix, e); toast(`${prefix}: ${e?.message || e || 'unknown error'}`); }
async function sb(run, fallback=null){ if(!supabase) return { data:fallback, error:null }; try { return await run(); } catch(e){ return { data:fallback, error:e }; } }

window.nav = async (id) => {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = $(id); if(el) el.classList.add('active');
  window.scrollTo({top:0, behavior:'smooth'});
  if(id==='home') await loadHome();
  if(id==='squads') await loadTeams();
  if(id==='market') { await loadServices(); await loadReviewsWall(); }
  if(id==='chat') await loadMessages();
  if(id==='rewards') await loadRewards();
  if(id==='profile') hydrateProfile();
  if(id==='seller') await loadSellerDashboard();
  if(id==='admin') await loadAdmin();
};
window.scrollTopNow = () => window.scrollTo({top:0, behavior:'smooth'});
window.toggleDrawer = (force) => { const d=$('drawer'); if(force===false) d.classList.add('hidden'); else d.classList.toggle('hidden'); };
window.toggleTheme = () => { document.body.classList.toggle('light'); localStorage.setItem('stackops-theme', document.body.classList.contains('light')?'light':'dark'); };
window.openAuth = () => state.user ? logout() : $('authModal').classList.remove('hidden');
window.closeAuth = () => $('authModal').classList.add('hidden');
window.closePay = () => $('payModal').classList.add('hidden');
window.copyUPI = async () => { await navigator.clipboard?.writeText(CONFIG.MANUAL_UPI_ID || 'ralhanx@ptaxis'); toast('UPI ID copied'); };

function defaultProfile(user){
  const email = (user.email || '').toLowerCase(); const admin = ADMIN_EMAILS.includes(email); const name = email.split('@')[0] || 'player';
  return { id:user.id, email, username:name, display_name:name, bio:'', role:admin?'admin':'user', account_status:'active', seller_status:admin?'approved':'none', is_seller:admin, is_verified:admin, xp:admin?99999999:120, equipped_title:admin?'Founder':'Rookie', equipped_badge:admin?'Origin Crown':'First Login', equipped_banner:admin?'Founder Crownline':'Starter Arena' };
}
function adminPatch(){ return { role:'admin', account_status:'active', seller_status:'approved', is_seller:true, is_verified:true, xp:99999999, equipped_title:'Founder', equipped_badge:'Origin Crown', equipped_banner:'Founder Crownline' }; }
async function currentUser(){
  if(!supabase){ const email=localStorage.getItem('demo_email'); return email ? { id:'demo_'+email, email } : null; }
  const { data } = await supabase.auth.getUser(); return data.user || null;
}
async function ensureProfile(){
  state.user = await currentUser();
  if(!state.user){ state.profile=null; state.isAdmin=false; document.body.classList.remove('is-admin'); $('authBtn').textContent='Login'; return; }
  state.isAdmin = ADMIN_EMAILS.includes((state.user.email||'').toLowerCase());
  if(!supabase){ state.profile = { ...defaultProfile(state.user), ...local.get('demo_profile', {}) }; if(state.isAdmin) state.profile={...state.profile,...adminPatch()}; }
  else{
    let { data, error } = await supabase.from('profiles').select('*').eq('id', state.user.id).maybeSingle();
    if(error) console.warn('profile load', error);
    if(!data){ const row=defaultProfile(state.user); const ins=await supabase.from('profiles').upsert(row).select('*').single(); data=ins.data || row; }
    if(state.isAdmin){ await supabase.from('profiles').update(adminPatch()).eq('id', state.user.id); data={...data,...adminPatch()}; await unlockAdminRewards(); }
    state.profile=data;
  }
  document.body.classList.toggle('is-admin', state.isAdmin);
  $('authBtn').textContent='Logout';
  await ensureStarterRewards();
  hydrateProfile();
  renderHomeProfile();
}

window.signup = async () => {
  const email=$('authEmail').value.trim(), password=$('authPassword').value;
  if(!email||!password) return toast('Enter email and password');
  if(!supabase){ localStorage.setItem('demo_email',email); closeAuth(); await ensureProfile(); await refreshAll(); return toast('Demo account ready'); }
  const { error } = await supabase.auth.signUp({ email, password }); if(error) return err('Signup failed', error);
  toast('Account created. Login now or check email confirmation.'); closeAuth(); await ensureProfile(); await refreshAll();
};
window.login = async () => {
  const email=$('authEmail').value.trim(), password=$('authPassword').value;
  if(!email||!password) return toast('Enter email and password');
  if(!supabase){ localStorage.setItem('demo_email',email); closeAuth(); await ensureProfile(); await refreshAll(); return toast('Logged in demo mode'); }
  const { error } = await supabase.auth.signInWithPassword({ email, password }); if(error) return err('Login failed', error);
  closeAuth(); await ensureProfile(); await refreshAll(); toast('Logged in');
};
async function logout(){ if(supabase) await supabase.auth.signOut(); localStorage.removeItem('demo_email'); state.user=null; state.profile=null; document.body.classList.remove('is-admin'); $('authBtn').textContent='Login'; toast('Logged out'); nav('home'); }

function setOnlineCounter(){ const min=CONFIG.ONLINE_COUNTER_MIN||2400,max=CONFIG.ONLINE_COUNTER_MAX||5600; let n=Number(localStorage.getItem('online_counter') || Math.floor(min+Math.random()*(max-min))); const paint=()=>{ $('onlineCount').textContent=n.toLocaleString('en-IN'); }; paint(); setInterval(()=>{ n += Math.floor(Math.random()*13)-4; n=Math.max(min,Math.min(max,n)); localStorage.setItem('online_counter',n); paint(); },1500); }
async function refreshAll(){ await Promise.all([loadHome(),loadTeams(),loadServices(),loadReviewsWall(),loadRewards(),loadLeaderboard(),loadSellerDashboard().catch(()=>{}), state.isAdmin?loadAdmin().catch(()=>{}):Promise.resolve()]); }
async function loadHome(){ await loadCounts(); await loadLeaderboard(); await loadProofCarousel(); renderHomeProfile(); renderQuests(); }
async function loadCounts(){
  let services=0, teams=0, reviews=0;
  if(supabase){
    services=(await supabase.from('seller_services').select('id',{count:'exact',head:true}).eq('status','active')).count||0;
    teams=(await supabase.from('teams').select('id',{count:'exact',head:true})).count||0;
    reviews=(await supabase.from('reviews').select('id',{count:'exact',head:true}).eq('status','approved')).count||0;
  } else { services=local.get('services').length; teams=local.get('teams').length; reviews=local.get('reviews').filter(r=>r.status==='approved').length; }
  $('serviceCount').textContent=services; $('teamCount').textContent=teams; $('reviewCount').textContent=reviews;
}
function renderHomeProfile(){
  const c=$('homeProfileCard'); if(!c) return;
  if(!state.profile){ c.innerHTML='<h2>Your StackOps identity</h2><p>Login to see XP, equipped title, badge, banner, daily gifts and leaderboard rank.</p><button class="primary" onclick="openAuth()">Login now</button>'; return; }
  c.innerHTML=`<div class="section-head"><h2>Your StackOps identity</h2><span>${state.isAdmin?'Founder admin • 1/1':'Player account'}</span></div>${identityPreview(state.profile)}<div class="big-xp">${Number(state.profile.xp||0).toLocaleString('en-IN')} <small>XP</small></div><div class="profile-pills"><span>Title <b>${escapeHtml(state.profile.equipped_title||'Rookie')}</b></span><span>Badge <b>${escapeHtml(state.profile.equipped_badge||'First Login')}</b></span><span>Banner <b>${escapeHtml(state.profile.equipped_banner||'Starter Arena')}</b></span></div><div class="button-row"><button class="primary" onclick="claimDailyXP()">Claim Daily XP</button><button class="ghost" onclick="nav('rewards')">Rewards shop</button><button class="ghost" onclick="nav('profile')">My details</button></div>`;
}
function renderQuests(){
  $('questGrid').innerHTML = [
    ['Daily login',80,'claimDailyXP()'],['Create a team',40,"nav('squads')"],['Send a chat message',25,"nav('chat')"],['Create a service',60,"nav('seller')"],['Submit a review',50,"nav('market')"]
  ].map(q=>`<article class="item-card"><b>${q[0]}</b><p>+${q[1]} XP</p><button class="small-btn" onclick="${q[2]}">Start</button></article>`).join('');
}

async function addXP(amount, source, note){
  if(!state.user || !state.profile) return;
  if(state.isAdmin){ toast(note || `+${amount} XP`); return; }
  const newXP=Number(state.profile.xp||0)+Number(amount||0); state.profile.xp=newXP;
  if(supabase){ await supabase.from('profiles').update({xp:newXP}).eq('id', state.user.id); await supabase.from('xp_history').insert({user_id:state.user.id,type:'earn',amount,source,note}); }
  else { local.set('demo_profile',state.profile); const h=local.get('xp_history'); h.unshift({type:'earn',amount,source,note,created_at:new Date().toISOString()}); local.set('xp_history',h); }
  renderHomeProfile(); renderIdentity(); await loadXPHistory();
}
async function spendXP(amount, source, note){
  if(state.isAdmin) return true;
  if(Number(state.profile?.xp||0)<amount){ toast(`Need ${amount} XP`); return false; }
  const newXP=Number(state.profile.xp)-amount; state.profile.xp=newXP;
  if(supabase){ await supabase.from('profiles').update({xp:newXP}).eq('id', state.user.id); await supabase.from('xp_history').insert({user_id:state.user.id,type:'spend',amount:-amount,source,note}); }
  else { local.set('demo_profile',state.profile); const h=local.get('xp_history'); h.unshift({type:'spend',amount:-amount,source,note,created_at:new Date().toISOString()}); local.set('xp_history',h); }
  renderHomeProfile(); renderIdentity(); await loadXPHistory(); return true;
}
window.claimDailyXP = async () => {
  if(!state.user) return openAuth();
  const d=today();
  if(supabase){ const got=await supabase.from('daily_claims').select('id').eq('user_id',state.user.id).eq('claim_date',d).maybeSingle(); if(got.data) return toast('Daily XP already claimed today'); await supabase.from('daily_claims').insert({user_id:state.user.id,claim_date:d,amount:80}); }
  else { const k='daily_'+state.user.id; if(localStorage.getItem(k)===d) return toast('Daily XP already claimed today'); localStorage.setItem(k,d); }
  await addXP(80,'daily','Daily login XP'); toast('+80 XP collected');
};

window.createTeam = async(e) => { e.preventDefault(); if(!state.user) return openAuth(); const row={owner_id:state.user.id,name:$('teamName').value.trim(),game:$('teamGame').value.trim(),rank:$('teamRank').value.trim(),note:$('teamNote').value.trim(),status:'open'}; if(supabase){ const {error}=await supabase.from('teams').insert(row); if(error) return err('Create team failed', error); } else { const a=local.get('teams'); a.unshift({...row,id:crypto.randomUUID(),created_at:new Date().toISOString()}); local.set('teams',a); } e.target.reset(); toast('Team created'); await addXP(40,'team_create','Created team'); await loadTeams(); await loadCounts(); };
window.loadTeams = async() => { let data=[]; if(supabase){ const res=await supabase.from('teams').select('*').order('created_at',{ascending:false}).limit(50); if(res.error) return $('teamsList').textContent='Cannot load teams: '+res.error.message; data=res.data||[]; } else data=local.get('teams'); $('teamsList').innerHTML=data.length?data.map(t=>`<article class="item-card"><b>${escapeHtml(t.name)}</b><p>${escapeHtml(t.game||'Game')} • ${escapeHtml(t.rank||'Any rank')}</p><small>${escapeHtml(t.note||'')}</small><button class="ghost" onclick="joinTeam()">Join / Request</button></article>`).join(''):'No teams yet. Create the first one.'; };
window.joinTeam=async()=>{ if(!state.user) return openAuth(); toast('Join request sent'); await addXP(20,'team_join','Requested to join team'); };

window.applySeller = async() => { if(!state.user) return openAuth(); if(canSell()) return toast('You are already approved as a seller'); const row={user_id:state.user.id,applicant_email:state.user.email,applicant_name:state.profile?.display_name||state.profile?.username||state.user.email,note:'Seller application submitted from StackOps',status:'pending'}; if(supabase){ const {error}=await supabase.from('seller_applications').upsert(row,{onConflict:'user_id'}); if(error) return err('Seller application failed', error); await supabase.from('profiles').update({seller_status:'pending'}).eq('id',state.user.id); } else { const apps=local.get('seller_apps'); apps.unshift({...row,id:crypto.randomUUID(),created_at:new Date().toISOString()}); local.set('seller_apps',apps); } toast('Seller application submitted'); await ensureProfile(); await loadSellerDashboard(); };
function canSell(){ return state.isAdmin || state.profile?.is_seller || state.profile?.seller_status==='approved'; }
window.createService = async(e) => { e.preventDefault(); if(!state.user) return openAuth(); if(!canSell()) return toast('Apply as seller first. Admin must approve before listings go live.'); const row={seller_id:state.user.id,title:$('serviceTitle').value.trim(),category:$('serviceCategory').value,price:Number($('servicePrice').value),description:$('serviceDesc').value.trim(),status:'active',platform_fee_percent:CONFIG.COMMISSION_PERCENT||10}; if(row.price<49||row.price>2999) return toast('Price must be ₹49–₹2999'); if(supabase){ const {error}=await supabase.from('seller_services').insert(row); if(error) return err('Create service failed', error); } else { const a=local.get('services'); a.unshift({...row,id:crypto.randomUUID(),created_at:new Date().toISOString()}); local.set('services',a); } e.target.reset(); toast('Service listing created'); await addXP(60,'service_create','Created service listing'); await loadServices(); await loadMyServices(); await loadCounts(); };
window.filterServices = async(cat) => { await loadServices(cat); };
window.loadServices = async(cat='all') => { let data=[]; if(supabase){ let q=supabase.from('seller_services').select('*').eq('status','active').order('created_at',{ascending:false}); if(cat!=='all') q=q.eq('category',cat); const res=await q; if(res.error) return $('servicesGrid').textContent='Cannot load services: '+res.error.message; data=res.data||[]; } else { data=local.get('services').filter(s=>cat==='all'||s.category===cat); } state.services=data; $('servicesGrid').classList.toggle('empty',!data.length); $('servicesGrid').innerHTML=data.length?data.map(s=>`<article class="service-card glass"><span class="tag">${escapeHtml(s.category)}</span><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.description)}</p><div class="price">${money(s.price)}</div><div class="button-row"><button class="primary" onclick="buyService('${s.id}')">Buy</button><button class="ghost" onclick="openReviewForm('${s.id}')">Review</button></div></article>`).join(''):'No live services yet. Approved sellers can create the first listing.'; };
window.buyService = (id) => { const s=state.services.find(x=>String(x.id)===String(id)); if(!s) return toast('Service not found'); openPayment({service_id:s.id,seller_id:s.seller_id,title:s.title,amount:s.price}); };
window.openPlanPayment = (title, amount) => openPayment({service_id:null,seller_id:null,title,amount});
function openPayment(item){ if(!state.user) return openAuth(); state.selectedService=item; $('payTitle').textContent=item.title; $('payAmount').textContent=money(item.amount); $('upiText').textContent=CONFIG.MANUAL_UPI_ID||'ralhanx@ptaxis'; $('payUtr').value=''; $('payProof').value=''; $('payModal').classList.remove('hidden'); }
async function fileToDataUrl(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }
async function uploadProof(file){
  if(!file) throw new Error('Upload payment screenshot');
  if(supabase){ const path=`proof-${Date.now()}-${file.name}`.replace(/[^a-zA-Z0-9_.-]/g,'_'); const up=await supabase.storage.from('payment-proofs').upload(path,file,{upsert:false}); if(!up.error){ const {data}=supabase.storage.from('payment-proofs').getPublicUrl(path); return data.publicUrl; } console.warn('Storage upload failed, using embedded fallback', up.error); }
  return await fileToDataUrl(file);
}
window.submitPaymentProof = async () => { if(!state.user) return openAuth(); const item=state.selectedService; if(!item) return toast('No item selected'); const utr=$('payUtr').value.trim(); const file=$('payProof').files[0]; if(!utr || !file) return toast('Enter UTR/reference and upload screenshot'); let proof; try{ proof=await uploadProof(file); }catch(e){ return err('Proof upload failed', e); } const feePct=CONFIG.COMMISSION_PERCENT||10; const amount=Number(item.amount); const row={buyer_id:state.user.id,seller_id:item.seller_id,service_id:item.service_id,service_title:item.title,amount,platform_fee:Math.round(amount*feePct)/100,seller_amount:Math.round(amount*(100-feePct))/100,utr,proof_url:proof,status:'pending',show_public:false}; if(supabase){ const {error}=await supabase.from('manual_orders').insert(row); if(error) return err('Payment submit failed', error); } else { const a=local.get('orders'); a.unshift({...row,id:crypto.randomUUID(),created_at:new Date().toISOString()}); local.set('orders',a); } closePay(); toast('Payment submitted. It will reflect within 24–48 hours after admin verification.'); await addXP(30,'payment_submit','Submitted payment proof'); await loadSellerDashboard(); };

window.loadSellerDashboard = async() => { if(!$('sellerGate')) return; if(!state.user){ $('sellerGate').innerHTML='<h2>Seller Studio</h2><p>Login to apply as seller and create services.</p><button class="primary" onclick="openAuth()">Login</button>'; return; } const status=canSell()?'approved':(state.profile?.seller_status||'none'); $('sellerGate').innerHTML=`<div class="section-head"><div><h2>Seller status: ${escapeHtml(status)}</h2><p>${canSell()?'Approved — you can create live service listings and earn through manual orders.':'Apply once. Founder/admin reviews seller applications manually.'}</p></div>${canSell()?'<span class="seller-approved">✓ Approved seller</span>':`<button class="primary" onclick="applySeller()" ${status==='pending'?'disabled':''}>${status==='pending'?'Application pending':'Apply to Sell'}</button>`}</div>`; await Promise.all([loadMyServices(),loadSellerOrders(),loadSellerWallet()]); };
window.loadMyServices = async() => { if(!state.user) return; let data=[]; if(supabase){ const res=await supabase.from('seller_services').select('*').eq('seller_id',state.user.id).order('created_at',{ascending:false}); if(res.error) return $('myServices').textContent='Cannot load services: '+res.error.message; data=res.data||[]; } else data=local.get('services').filter(s=>s.seller_id===state.user.id); $('myServices').innerHTML=data.length?data.map(s=>`<article class="item-card"><b>${escapeHtml(s.title)}</b><p>${money(s.price)} • ${escapeHtml(s.status)}</p><small>${escapeHtml(s.description)}</small></article>`).join(''):'No services yet.'; };
async function loadSellerOrders(){ if(!state.user) return; let data=[]; if(supabase){ const res=await supabase.from('manual_orders').select('*').eq('seller_id',state.user.id).order('created_at',{ascending:false}); if(res.error) return $('sellerOrders').textContent='Cannot load orders: '+res.error.message; data=res.data||[]; } else data=local.get('orders').filter(o=>o.seller_id===state.user.id); $('sellerOrders').innerHTML=data.length?data.map(o=>`<article class="order-card"><b>${escapeHtml(o.service_title)}</b><p>${money(o.amount)} • ${escapeHtml(o.status)}</p><small>Seller earning: ${money(o.seller_amount)}</small></article>`).join(''):'No orders yet.'; }
async function loadSellerWallet(){ if(!state.user) return; let approved=0,pending=0,orders=0; if(supabase){ const res=await supabase.from('manual_orders').select('seller_amount,status').eq('seller_id',state.user.id); (res.data||[]).forEach(o=>{orders++; if(o.status==='approved') approved+=Number(o.seller_amount||0); if(o.status==='pending') pending+=Number(o.seller_amount||0);}); } else local.get('orders').filter(o=>o.seller_id===state.user.id).forEach(o=>{orders++; if(o.status==='approved') approved+=Number(o.seller_amount||0); if(o.status==='pending') pending+=Number(o.seller_amount||0);}); $('sellerWallet').innerHTML=`<div><b>${money(approved)}</b><span>approved earnings</span></div><div><b>${orders}</b><span>orders</span></div><div><b>${money(pending)}</b><span>pending</span></div>`; }
window.requestPayout = async() => { if(!state.user) return openAuth(); let amount=0; if(supabase){ const res=await supabase.from('manual_orders').select('seller_amount').eq('seller_id',state.user.id).eq('status','approved'); amount=(res.data||[]).reduce((a,o)=>a+Number(o.seller_amount||0),0); const {error}=await supabase.from('seller_payouts').insert({seller_id:state.user.id,amount,status:'pending'}); if(error) return err('Payout request failed', error); } toast('Payout request submitted'); };

window.sendMessage = async(e) => { e.preventDefault(); if(!state.user) return openAuth(); const body=$('messageInput').value.trim(); if(!body) return; const row={user_id:state.user.id,room:state.room,body,username:state.profile?.display_name||state.profile?.username||state.user.email}; if(supabase){ const {error}=await supabase.from('messages').insert(row); if(error) return err('Send failed', error); } else { const a=local.get('messages'); a.push({...row,id:crypto.randomUUID(),created_at:new Date().toISOString()}); local.set('messages',a); } e.target.reset(); await addXP(25,'chat','Sent chat message'); await loadMessages(); };
window.switchRoom = async(r) => { state.room=r; $('roomTitle').textContent='# '+r; await loadMessages(); };
window.loadMessages = async() => { let data=[]; if(supabase){ const res=await supabase.from('messages').select('*').eq('room',state.room).order('created_at',{ascending:true}).limit(80); if(res.error) return $('messagesList').textContent='Cannot load messages: '+res.error.message; data=res.data||[]; } else data=local.get('messages').filter(m=>m.room===state.room); $('messagesList').innerHTML=data.length?data.map(m=>`<div class="message ${m.user_id===state.user?.id?'mine':''}"><b>${escapeHtml(m.username||uid8(m.user_id))}</b><p>${escapeHtml(m.body)}</p></div>`).join(''):'No messages yet. Say hi.'; const box=$('messagesList'); box.scrollTop=box.scrollHeight; };

window.placeMarker = (e) => { const b=$('tacticBoard'); const r=b.getBoundingClientRect(); const m=document.createElement('span'); m.className='marker'; m.style.left=(e.clientX-r.left)+'px'; m.style.top=(e.clientY-r.top)+'px'; b.appendChild(m); };
window.clearMarkers = () => $('tacticBoard').innerHTML='';
window.saveTactic = async() => { if(!state.user) return openAuth(); toast('Tactic saved locally'); await addXP(30,'planner','Saved tactic'); };
window.generateRoutine = async() => { const q=$('aiPrompt').value.trim(); if(!q) return toast('Write your goal first'); const routine=`<article class="item-card"><b>Practice routine</b><p>1) 8 min crosshair placement warmup. 2) 2 deathmatches focusing only calm peeks. 3) Review one round where you died first. 4) Queue with one goal: trade teammate within 2 seconds. 5) Track one improvement after each match.</p><small>${escapeHtml(q)}</small></article>`; $('aiOutput').innerHTML=routine; await addXP(20,'learn','Generated training routine'); };

const defaultRewards = [
  {key:'title_rookie',type:'title',name:'Rookie',description:'Default starter title',cost:0,admin_only:false},
  {key:'badge_first_login',type:'badge',name:'First Login',description:'Welcome badge',cost:0,admin_only:false},
  {key:'banner_starter',type:'banner',name:'Starter Arena',description:'Default arena banner',cost:0,admin_only:false},
  {key:'title_clutch_mind',type:'title',name:'Clutch Mind',description:'For consistent daily grinders',cost:500,admin_only:false},
  {key:'badge_first_stack',type:'badge',name:'First Stack',description:'Create or join your first team',cost:650,admin_only:false},
  {key:'banner_redline',type:'banner',name:'Redline Protocol',description:'Premium red glass banner',cost:1400,admin_only:false},
  {key:'title_radiant_captain',type:'title',name:'Radiant Captain',description:'High-tier leadership identity',cost:2800,admin_only:false},
  {key:'badge_verified_coach',type:'badge',name:'Verified Coach',description:'Trusted seller/coach badge',cost:2000,admin_only:false},
  {key:'admin_founder_title',type:'title',name:'Founder',description:'1 of 1 founder-only title',cost:0,admin_only:true},
  {key:'admin_origin_crown',type:'badge',name:'Origin Crown',description:'1 of 1 founder-only crown badge',cost:0,admin_only:true},
  {key:'admin_founder_crownline',type:'banner',name:'Founder Crownline',description:'1 of 1 founder-only banner',cost:0,admin_only:true}
];
async function ensureStarterRewards(){ if(!state.user) return; if(supabase){ await supabase.from('user_rewards').upsert([{user_id:state.user.id,reward_key:'title_rookie'},{user_id:state.user.id,reward_key:'badge_first_login'},{user_id:state.user.id,reward_key:'banner_starter'}],{onConflict:'user_id,reward_key'}); if(state.isAdmin) await unlockAdminRewards(); } else { const a=new Set(local.get('unlocked',[ 'title_rookie','badge_first_login','banner_starter' ])); ['title_rookie','badge_first_login','banner_starter'].forEach(x=>a.add(x)); if(state.isAdmin) defaultRewards.filter(r=>r.admin_only).forEach(r=>a.add(r.key)); local.set('unlocked',[...a]); } }
async function unlockAdminRewards(){ if(!state.user || !supabase) return; const rows=defaultRewards.filter(r=>r.admin_only||r.cost===0).map(r=>({user_id:state.user.id,reward_key:r.key})); await supabase.from('user_rewards').upsert(rows,{onConflict:'user_id,reward_key'}); }
window.loadRewards = async() => { if(!state.user) return openAuth(); let rewards=defaultRewards, unlocked=[]; if(supabase){ const rd=await supabase.from('reward_defs').select('*').order('sort_order'); rewards=(rd.data&&rd.data.length)?rd.data:defaultRewards; const ur=await supabase.from('user_rewards').select('reward_key').eq('user_id',state.user.id); unlocked=(ur.data||[]).map(x=>x.reward_key); } else { unlocked=local.get('unlocked',['title_rookie','badge_first_login','banner_starter']); }
  state.rewards=rewards; state.unlocked=new Set(unlocked); renderIdentity(); renderRewards(); await loadXPHistory(); await loadLeaderboard(); };
function renderIdentity(){ if(!state.profile) return; const strip=$('identityStrip'); if(strip) strip.innerHTML=`<div><span class="tag">${state.isAdmin?'Founder 1/1':'Player'}</span><b>${Number(state.profile.xp||0).toLocaleString('en-IN')} XP</b></div><div><b>${escapeHtml(state.profile.equipped_title||'Rookie')}</b><span>Title</span></div><div><b>${escapeHtml(state.profile.equipped_badge||'First Login')}</b><span>Badge</span></div><div><b>${escapeHtml(state.profile.equipped_banner||'Starter Arena')}</b><span>Banner</span></div>${identityPreview(state.profile,true)}`; const eq=$('equippedIdentity'); if(eq) eq.innerHTML=identityPreview(state.profile); }
function renderRewards(){ $('rewardsGrid').innerHTML=state.rewards.map(r=>{ const unlocked=state.isAdmin||state.unlocked.has(r.key); const lockedAdmin=r.admin_only&&!state.isAdmin; return `<article class="reward-card ${r.admin_only?'admin-only-card':''}">${rewardPreview(r)}<span class="reward-type">${r.admin_only?'1 of 1 founder':r.type}</span><h3>${escapeHtml(r.name)}</h3><p>${escapeHtml(r.description||'')}</p><b>${r.admin_only?'Founder only':(Number(r.cost||0).toLocaleString('en-IN')+' XP')}</b><button class="${unlocked?'ghost':'primary'}" onclick="${unlocked?`equipReward('${r.key}')`:`unlockReward('${r.key}')`}" ${lockedAdmin?'disabled':''}>${unlocked?'Equip':'Unlock'}</button></article>`; }).join(''); }
window.unlockReward = async(key) => { if(!state.user) return openAuth(); const r=state.rewards.find(x=>x.key===key); if(!r) return; if(r.admin_only&&!state.isAdmin) return toast('Founder only'); if(!(await spendXP(Number(r.cost||0),'reward_unlock','Unlocked '+r.name))) return; if(supabase) await supabase.from('user_rewards').upsert({user_id:state.user.id,reward_key:key},{onConflict:'user_id,reward_key'}); else { const a=new Set(local.get('unlocked',[])); a.add(key); local.set('unlocked',[...a]); } state.unlocked.add(key); toast('Unlocked '+r.name); renderRewards(); };
window.equipReward = async(key) => { if(!state.user) return openAuth(); const r=state.rewards.find(x=>x.key===key); if(!r) return; const patch={}; if(r.type==='title') patch.equipped_title=r.name; if(r.type==='badge') patch.equipped_badge=r.name; if(r.type==='banner') patch.equipped_banner=r.name; if(supabase){ const {error}=await supabase.from('profiles').update(patch).eq('id',state.user.id); if(error) return err('Equip failed', error); } else { local.set('demo_profile',{...state.profile,...patch}); } state.profile={...state.profile,...patch}; toast('Equipped '+r.name); renderIdentity(); renderHomeProfile(); };
async function loadXPHistory(){ if(!state.user) return; let data=[]; if(supabase){ const res=await supabase.from('xp_history').select('*').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(30); data=res.data||[]; } else data=local.get('xp_history'); $('xpHistory').innerHTML=data.length?data.map(x=>`<article class="item-card"><b>${Number(x.amount)>0?'+':''}${x.amount} XP</b><p>${escapeHtml(x.note||x.source||'XP')}</p><small>${new Date(x.created_at).toLocaleString()}</small></article>`).join(''):'No XP history yet.'; }
async function loadLeaderboard(){ let data=[]; if(supabase){ const res=await supabase.from('profiles').select('id,username,display_name,xp,equipped_title,equipped_badge').order('xp',{ascending:false}).limit(20); data=res.data||[]; } else data=[state.profile].filter(Boolean); if(state.profile && !data.some(p=>p.id===state.profile.id)) data.unshift(state.profile); $('leaderboard').innerHTML=data.length?data.map((p,i)=>`<article class="leader-card ${p.id===state.user?.id?'me':''}"><b>#${i+1} ${escapeHtml(p.display_name||p.username||'player')}</b><p>${Number(p.xp||0).toLocaleString('en-IN')} XP • ${escapeHtml(p.equipped_title||'Rookie')} ${String(p.equipped_badge||'').includes('Origin')?'♛':''}</p></article>`).join(''):'No leaderboard yet. Login once after SQL reset.'; }

function hydrateProfile(){ const p=state.profile; if(!p) return; if($('profileUsername')) $('profileUsername').value=p.username||''; if($('profileDisplay')) $('profileDisplay').value=p.display_name||''; if($('profileBio')) $('profileBio').value=p.bio||''; $('profileStatus').innerHTML=`<article class="item-card"><b>${escapeHtml(p.display_name||p.username)}</b><p>${escapeHtml(p.email||'')}</p><p>${escapeHtml(p.role)} • seller: ${escapeHtml(p.seller_status)} • verified: ${p.is_verified?'yes':'no'}</p><p>${Number(p.xp||0).toLocaleString('en-IN')} XP</p></article>`; renderIdentity(); }
window.saveProfile = async(e) => { e.preventDefault(); if(!state.user) return openAuth(); const patch={username:$('profileUsername').value.trim(),display_name:$('profileDisplay').value.trim(),bio:$('profileBio').value.trim()}; if(supabase){ const {error}=await supabase.from('profiles').update(patch).eq('id',state.user.id); if(error) return err('Save profile failed', error); } else { local.set('demo_profile',{...state.profile,...patch}); } state.profile={...state.profile,...patch}; toast('Profile saved'); await addXP(20,'profile','Updated profile'); hydrateProfile(); };

window.openReviewForm = (serviceId) => { if(!state.user) return openAuth(); const rating=prompt('Rating 1-5?','5'); if(!rating) return; const body=prompt('Write review'); if(!body) return; submitReview(serviceId, Number(rating), body); };
window.openGeneralReview = () => { if(!state.user) return openAuth(); const rating=prompt('Platform rating 1-5?','5'); if(!rating) return; const body=prompt('Write feedback for StackOps'); if(!body) return; submitReview(null, Number(rating), body); };
async function submitReview(serviceId,rating,body){ const row={service_id:serviceId,user_id:state.user.id,rating:Math.max(1,Math.min(5,rating||5)),body,status:'pending'}; if(supabase){ const {error}=await supabase.from('reviews').insert(row); if(error) return err('Review failed', error); } else { const a=local.get('reviews'); a.unshift({...row,id:crypto.randomUUID(),created_at:new Date().toISOString()}); local.set('reviews',a); } toast('Review submitted for approval'); await addXP(50,'review','Submitted review'); }
async function loadReviewsWall(){ let data=[]; if(supabase){ const res=await supabase.from('reviews').select('*').eq('status','approved').order('created_at',{ascending:false}).limit(20); data=res.data||[]; } else data=local.get('reviews').filter(r=>r.status==='approved'); $('reviewsWall').innerHTML=data.length?data.map(r=>`<article class="review-card"><b>${'★'.repeat(Number(r.rating||5))}</b><p>${escapeHtml(r.body)}</p></article>`).join(''):'Approved reviews will show here.'; }
async function loadProofCarousel(){ let data=[]; if(supabase){ const res=await supabase.from('manual_orders').select('service_title,amount,proof_url,created_at').eq('status','approved').eq('show_public',true).order('created_at',{ascending:false}).limit(8); data=res.data||[]; } else data=local.get('orders').filter(o=>o.status==='approved'&&o.show_public); $('proofCarousel').innerHTML=data.length?data.map(o=>`<article class="proof-card"><img src="${o.proof_url}" alt="payment proof"><b>${escapeHtml(o.service_title)}</b><p>${money(o.amount)} verified</p></article>`).join(''):'Real approved payments and feedback will appear here after admin approval.'; }

window.adminTab = async(tab) => { state.adminTab=tab; await loadAdmin(); };
async function loadAdmin(){ const c=$('adminContent'); if(!state.isAdmin){ c.textContent='Admin only. Login with founder email.'; return; } await loadAdminStats(); if(state.adminTab==='seller') return adminSeller(c); if(state.adminTab==='payments') return adminPayments(c); if(state.adminTab==='payouts') return adminPayouts(c); if(state.adminTab==='reviews') return adminReviews(c); if(state.adminTab==='users') return adminUsers(c); }
async function loadAdminStats(){ if(!supabase) return; const users=await supabase.from('profiles').select('id',{count:'exact',head:true}); const orders=await supabase.from('manual_orders').select('id',{count:'exact',head:true}).eq('status','pending'); const apps=await supabase.from('seller_applications').select('id',{count:'exact',head:true}).eq('status','pending'); $('admUsers').textContent=users.count||0; $('admOrders').textContent=orders.count||0; $('admSellerApps').textContent=apps.count||0; const g=await supabase.from('manual_orders').select('amount').eq('status','approved'); $('admGMV').textContent=money((g.data||[]).reduce((a,o)=>a+Number(o.amount||0),0)); }
async function adminSeller(c){ const res=await supabase.from('seller_applications').select('*').order('created_at',{ascending:false}); if(res.error) return c.textContent='Seller apps blocked: '+res.error.message; c.innerHTML='<h2>Seller applications</h2>'+((res.data||[]).length?(res.data||[]).map(a=>`<article class="item-card"><b>${escapeHtml(a.applicant_name||uid8(a.user_id))}</b><p>${escapeHtml(a.applicant_email||'')} • ${escapeHtml(a.status)}</p><small>${escapeHtml(a.note||'')}</small><div class="button-row"><button class="primary" onclick="approveSeller('${a.user_id}','${a.id}')">Approve</button><button class="ghost" onclick="rejectSeller('${a.id}')">Reject</button></div></article>`).join(''):'No seller applications.'); }
window.approveSeller=async(userId,appId)=>{ await supabase.from('profiles').update({is_seller:true,seller_status:'approved',is_verified:true}).eq('id',userId); await supabase.from('seller_applications').update({status:'approved',reviewed_at:new Date().toISOString()}).eq('id',appId); toast('Seller approved'); loadAdmin(); };
window.rejectSeller=async(appId)=>{ await supabase.from('seller_applications').update({status:'rejected',reviewed_at:new Date().toISOString()}).eq('id',appId); toast('Seller rejected'); loadAdmin(); };
async function adminPayments(c){ const res=await supabase.from('manual_orders').select('*').order('created_at',{ascending:false}); if(res.error) return c.textContent='Orders blocked: '+res.error.message; c.innerHTML='<h2>Manual payment orders</h2>'+((res.data||[]).length?(res.data||[]).map(o=>`<article class="order-card"><b>${escapeHtml(o.service_title)}</b><p>${money(o.amount)} • ${escapeHtml(o.status)}</p><p>UTR: ${escapeHtml(o.utr||'missing')}</p>${o.proof_url?`<a class="ghost" target="_blank" href="${o.proof_url}">View proof</a>`:''}<div class="button-row"><button class="primary" onclick="approveOrder('${o.id}')">Approve</button><button class="ghost" onclick="rejectOrder('${o.id}')">Reject</button></div></article>`).join(''):'No orders yet.'); }
window.approveOrder=async(id)=>{ const one=await supabase.from('manual_orders').select('*').eq('id',id).single(); const o=one.data; await supabase.from('manual_orders').update({status:'approved',approved_at:new Date().toISOString(),show_public:true}).eq('id',id); if(o?.seller_id){ await supabase.from('seller_wallets').upsert({seller_id:o.seller_id,available:0,pending:0,total_earned:0},{onConflict:'seller_id'}); const w=await supabase.from('seller_wallets').select('*').eq('seller_id',o.seller_id).single(); const wallet=w.data||{available:0,total_earned:0}; await supabase.from('seller_wallets').update({available:Number(wallet.available||0)+Number(o.seller_amount||0),total_earned:Number(wallet.total_earned||0)+Number(o.seller_amount||0)}).eq('seller_id',o.seller_id); } toast('Order approved'); loadAdmin(); };
window.rejectOrder=async(id)=>{ await supabase.from('manual_orders').update({status:'rejected'}).eq('id',id); toast('Order rejected'); loadAdmin(); };
async function adminPayouts(c){ const res=await supabase.from('seller_payouts').select('*').order('created_at',{ascending:false}); if(res.error) return c.textContent='Payouts blocked: '+res.error.message; c.innerHTML='<h2>Payout requests</h2>'+((res.data||[]).length?(res.data||[]).map(p=>`<article class="item-card"><b>${money(p.amount)}</b><p>${escapeHtml(p.status)}</p><button class="primary" onclick="markPayoutPaid('${p.id}')">Mark paid</button></article>`).join(''):'No payout requests.'); }
window.markPayoutPaid=async(id)=>{ await supabase.from('seller_payouts').update({status:'paid',paid_at:new Date().toISOString()}).eq('id',id); toast('Payout paid'); loadAdmin(); };
async function adminReviews(c){ const res=await supabase.from('reviews').select('*').order('created_at',{ascending:false}); if(res.error) return c.textContent='Reviews blocked: '+res.error.message; c.innerHTML='<h2>Review moderation</h2>'+((res.data||[]).length?(res.data||[]).map(r=>`<article class="review-card"><b>${'★'.repeat(Number(r.rating||5))}</b><p>${escapeHtml(r.body)}</p><small>${escapeHtml(r.status)}</small><button class="primary" onclick="approveReview('${r.id}')">Approve</button></article>`).join(''):'No reviews yet.'); }
window.approveReview=async(id)=>{ await supabase.from('reviews').update({status:'approved'}).eq('id',id); toast('Review approved'); loadAdmin(); };
async function adminUsers(c){ const res=await supabase.from('profiles').select('*').order('xp',{ascending:false}).limit(50); if(res.error) return c.textContent='Users blocked: '+res.error.message; c.innerHTML='<h2>Users</h2>'+((res.data||[]).map(u=>`<article class="item-card"><b>${escapeHtml(u.display_name||u.username||u.email)}</b><p>${escapeHtml(u.role)} • seller: ${escapeHtml(u.seller_status)} • ${Number(u.xp||0).toLocaleString()} XP</p><div class="button-row"><button class="primary" onclick="verifyUser('${u.id}')">Verify</button><button class="ghost" onclick="banUser('${u.id}')">Ban</button></div></article>`).join('')||'No users.'); }
window.verifyUser=async(id)=>{ await supabase.from('profiles').update({is_verified:true}).eq('id',id); toast('User verified'); loadAdmin(); };
window.banUser=async(id)=>{ await supabase.from('profiles').update({account_status:'banned'}).eq('id',id); toast('User banned'); loadAdmin(); };

async function boot(){ try{ if(localStorage.getItem('stackops-theme')==='light') document.body.classList.add('light'); setTimeout(()=>$('intro')?.classList.add('done'),650); setOnlineCounter(); await ensureProfile(); await refreshAll(); if(supabase) supabase.auth.onAuthStateChange(async()=>{ await ensureProfile(); await refreshAll(); }); setInterval(()=>loadHome().catch(()=>{}),30000); } catch(e){ console.error(e); toast('App loaded with warning: '+(e.message||e)); $('intro')?.classList.add('done'); } }
boot();
