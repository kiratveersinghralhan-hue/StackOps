const CFG = window.STACKOPS_CONFIG || {};
const sb = (CFG.SUPABASE_URL || '').includes('YOUR_PROJECT') ? null : supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
let currentUser = null;
let currentProfile = null;
let activeChannel = 'global';
let chatSub = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const sample = {
  squads:[
    {name:'Mumbai Ascendants',game:'Valorant',region:'Asia / Mumbai',rank_required:'Gold+',description:'Rank push, calm comms, no toxicity.'},
    {name:'Rift Strategy Room',game:'League of Legends',region:'Global',rank_required:'Any',description:'Draft review and flex queue group.'},
    {name:'TFT Mindgames',game:'TFT',region:'Asia',rank_required:'Platinum+',description:'Study comps, climb and queue together.'},
    {name:'Wild Rift Night Ops',game:'Wild Rift',region:'India',rank_required:'Emerald+',description:'Late night mobile squad.'}
  ],
  services:[
    {title:'Valorant Aim + VOD Review',game:'Valorant',price_inr:799,description:'One hour session with notes and drills.',status:'approved'},
    {title:'Duo Queue Coaching',game:'Valorant',price_inr:1499,description:'Live ranked coaching with comms.',status:'approved'},
    {title:'LoL Macro Review',game:'League of Legends',price_inr:999,description:'Lane, wave and objective planning.',status:'approved'}
  ],
  posts:[
    {content:'Dropped 31 in ranked. Looking for serious trio tonight.',display_name:'RiotGrinder',badge:'Gold'},
    {content:'New coaching slots open for Mumbai/Asia players.',display_name:'CoachOps',badge:'Verified Seller'},
    {content:'Who is queueing Swiftplay before comp?',display_name:'NeonEntry',badge:'Starter'}
  ]
};
const plans = [
  ['free','Free',0,'Starter access','Basic profile, guest discovery, public feed'],
  ['bronze','Bronze',199,'Bronze card','Extra squad invites, bronze title, basic banner'],
  ['silver','Silver',499,'Silver glow','Priority profile, marketplace discounts, silver badge'],
  ['gold','Gold',999,'Gold identity','Animated title, profile boost, advanced filters'],
  ['diamond','Diamond',2499,'Diamond elite','Premium banners, seller boost, VIP matchmaking'],
  ['legend','Legend',5999,'Legend crown','Highest profile priority, exclusive banner collection, VIP support']
];
const languages = ['English','Hindi','Punjabi','Spanish','French','German','Arabic','Portuguese','Russian','Japanese','Korean','Chinese','Indonesian','Turkish','Italian','Dutch','Bengali','Tamil','Telugu','Marathi','Gujarati','Urdu'];

function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; $('#toastRoot').appendChild(t); setTimeout(()=>t.remove(),3200); }
function isAdminEmail(email){ return (CFG.ADMIN_EMAILS||[]).map(e=>e.toLowerCase()).includes((email||'').toLowerCase()); }
function commission(amount){ const r=(CFG.COMMISSION_RULES||[]).find(x=>amount>=x.min&&amount<=x.max)||{rate:15}; return Math.round(amount*r.rate/100); }
function money(n){ return '₹'+Number(n||0).toLocaleString('en-IN'); }

function route(name){ $$('.page').forEach(p=>p.classList.remove('active')); const page=$('#page-'+name); if(page) page.classList.add('active'); $$('.nav a').forEach(a=>a.classList.toggle('active',a.dataset.route===name)); if(name==='admin') loadAdmin(); }
function wireNavigation(){ $$('[data-route]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault(); route(el.dataset.route); history.replaceState(null,'','#'+el.dataset.route); })); }

function renderStatic(){
  $('#languageSelect').innerHTML = languages.map(x=>`<option>${x}</option>`).join('');
  $('#tickerTrack').textContent = '  Phoenix joined Mumbai Ascendants  •  CoachOps earned ₹1,274  •  4 sellers awaiting crown review  •  NeonEntry unlocked Gold identity  •  Valorant Ranked channel is active  •  ';
  renderPlans(); renderSquads(sample.squads); renderServices(sample.services); renderPosts(sample.posts); animateCounters();
}
function animateCounters(){ setInterval(()=>{ $('#onlineCounter').textContent=(1200+Math.floor(Math.random()*180)).toLocaleString(); $('#squadCounter').textContent=(310+Math.floor(Math.random()*40)).toLocaleString(); },2200); }
function renderPlans(){ $('#plansGrid').innerHTML = plans.map(([key,name,price,tag,features])=>`<article class="game-card plan-card"><span class="tag">${tag}</span><h3>${name}</h3><div class="price">${price?money(price):'₹0'}</div><p>${features}</p><button class="btn primary full" onclick="buyPlan('${key}',${price})">${price?'Pay test mode':'Activate free'}</button></article>`).join(''); }
function renderSquads(rows){ $('#squadGrid').innerHTML = rows.map(s=>`<article class="game-card"><span class="tag">${s.game||'Riot'}</span><h3>${s.name}</h3><p>${s.description||''}</p><div class="meta"><span class="tag">${s.region||'Global'}</span><span class="tag">${s.rank_required||'Any rank'}</span></div><button class="btn glass full" onclick="toast('Invite request sent')">Request Join</button></article>`).join(''); }
function renderServices(rows){ $('#serviceGrid').innerHTML = rows.map(s=>`<article class="game-card"><span class="tag">${s.status==='approved'?'Verified':'Pending'}</span><h3>${s.title}</h3><p>${s.description||''}</p><div class="meta"><span class="tag">${s.game||'Riot'}</span><span class="tag">${money(s.price_inr)}</span><span class="tag">Commission ${money(commission(s.price_inr))}</span></div><button class="btn primary full" onclick="buyService('${s.id||''}',${s.price_inr||0},'${String(s.title).replaceAll("'",'')}')">Book Service</button></article>`).join(''); }
function renderPosts(rows){ $('#feedList').innerHTML = rows.map(p=>`<article class="game-card"><div class="meta"><span class="tag">${p.display_name||'Player'}</span><span class="tag">${p.badge||'Starter'}</span></div><p>${p.content||''}</p>${p.image_url?`<img src="${p.image_url}" style="width:100%;border-radius:18px;border:1px solid var(--line)">`:''}</article>`).join(''); }

async function initAuth(){ if(!sb){ toast('Demo mode: add Supabase keys in config.js'); return; } const {data}=await sb.auth.getUser(); currentUser=data.user; await loadProfile(); sb.auth.onAuthStateChange(async()=>{ const {data}=await sb.auth.getUser(); currentUser=data.user; await loadProfile(); await loadAll(); }); }
async function loadProfile(){ if(!currentUser){ currentProfile=null; updateAuthUI(); return; } let {data}=await sb.from('profiles').select('*').eq('id',currentUser.id).maybeSingle(); currentProfile=data; updateAuthUI(); }
function updateAuthUI(){ $('#authOpenBtn').textContent=currentUser?(currentProfile?.display_name||currentUser.email):'Login'; const admin= currentUser && (isAdminEmail(currentUser.email)||currentProfile?.role==='admin'); $$('.admin-only').forEach(x=>x.classList.toggle('hidden',!admin)); }
async function loadAll(){ if(!sb) return; const [sq,sv,po] = await Promise.all([sb.from('squads').select('*').order('created_at',{ascending:false}).limit(24),sb.from('services').select('*').in('status',['approved','pending']).order('created_at',{ascending:false}).limit(24),sb.from('posts').select('*, profiles(display_name,badge)').order('created_at',{ascending:false}).limit(30)]); if(sq.data?.length) renderSquads(sq.data); if(sv.data?.length) renderServices(sv.data); if(po.data?.length) renderPosts(po.data.map(p=>({...p,display_name:p.profiles?.display_name,badge:p.profiles?.badge}))); subscribeChat(); }

async function signup(){ if(!sb) return toast('Add Supabase config first'); const email=$('#authEmail').value.trim(), password=$('#authPassword').value; const {error}=await sb.auth.signUp({email,password}); if(error) toast(error.message); else toast('Signup done. Check email if confirmation is enabled.'); }
async function login(){ if(!sb) return toast('Add Supabase config first'); const {error}=await sb.auth.signInWithPassword({email:$('#authEmail').value.trim(),password:$('#authPassword').value}); if(error) toast(error.message); else { $('#authModal').classList.add('hidden'); toast('Welcome to StackOps'); } }
async function logout(){ if(sb) await sb.auth.signOut(); toast('Logged out'); }
async function createSquad(){ if(!currentUser) return toast('Login first'); const payload={owner_id:currentUser.id,name:$('#sqName').value,game:$('#sqGame').value||'Valorant',region:$('#sqRegion').value,rank_required:$('#sqRank').value,description:$('#sqDesc').value}; const {error}=await sb.from('squads').insert(payload); if(error) toast(error.message); else {toast('Squad created'); $('#squadModal').classList.add('hidden'); loadAll();}}
async function createService(){ if(!currentUser) return toast('Login first'); const price=Number($('#svcPrice').value||0); const payload={owner_id:currentUser.id,title:$('#svcTitle').value,game:$('#svcGame').value||'Valorant',price_inr:price,commission_percent:Math.round(commission(price)/Math.max(price,1)*100),description:$('#svcDesc').value,status:'pending'}; const {error}=await sb.from('services').insert(payload); if(error) toast(error.message); else {toast('Seller request submitted for admin approval'); $('#serviceModal').classList.add('hidden'); loadAll();}}
async function createPost(){ if(!currentUser) return toast('Login first'); const payload={user_id:currentUser.id,content:$('#postText').value}; const {error}=await sb.from('posts').insert(payload); if(error) toast(error.message); else {$('#postText').value=''; toast('Posted'); loadAll();}}

function buyPlan(key,amount){ if(!amount){ toast('Free plan activated'); return; } openRazorpay(`StackOps ${key} plan`, amount, async(pay)=>{ if(sb&&currentUser) await sb.from('orders').insert({buyer_id:currentUser.id,plan_key:key,amount_inr:amount,platform_commission_inr:0,status:'paid',razorpay_payment_id:pay.razorpay_payment_id}); toast('Payment captured in test mode'); }); }
function buyService(id,amount,title){ openRazorpay(title||'StackOps Service',amount,async(pay)=>{ if(sb&&currentUser) await sb.from('orders').insert({buyer_id:currentUser.id,service_id:id||null,amount_inr:amount,platform_commission_inr:commission(amount),status:'paid',razorpay_payment_id:pay.razorpay_payment_id}); toast('Service booked in test mode'); }); }
function openRazorpay(name,amount,handler){ if(!window.Razorpay || !(CFG.RAZORPAY_KEY_ID||'').startsWith('rzp_')) return toast('Add Razorpay test key in config.js'); new Razorpay({key:CFG.RAZORPAY_KEY_ID,amount:amount*100,currency:'INR',name:'StackOps Arena',description:name,theme:{color:'#ff4655'},handler}).open(); }

function subscribeChat(){ if(!sb || chatSub) return; loadChat(); chatSub=sb.channel('chat-live').on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},payload=>{ if(payload.new.channel===activeChannel) addMessage(payload.new); }).subscribe(); }
async function loadChat(){ if(!sb) return; const {data}=await sb.from('messages').select('*, profiles(display_name)').eq('channel',activeChannel).order('created_at',{ascending:true}).limit(80); $('#chatMessages').innerHTML=''; (data||[]).forEach(m=>addMessage({...m,display_name:m.profiles?.display_name})); }
function addMessage(m){ const d=document.createElement('div'); d.className='msg '+(m.user_id===currentUser?.id?'me':''); d.innerHTML=`<b>${m.display_name||'Player'}</b>${m.content}`; $('#chatMessages').appendChild(d); $('#chatMessages').scrollTop=$('#chatMessages').scrollHeight; }
async function sendChat(){ if(!currentUser) return toast('Login to chat'); const text=$('#chatInput').value.trim(); if(!text) return; $('#chatInput').value=''; const {error}=await sb.from('messages').insert({user_id:currentUser.id,channel:activeChannel,content:text}); if(error) toast(error.message); }

async function loadAdmin(){ const admin=currentUser&&(isAdminEmail(currentUser.email)||currentProfile?.role==='admin'); if(!admin){ $('#adminUsers').innerHTML='<p class="hint">Admin email login required.</p>'; return; } if(!sb) return; const [u,s,o]=await Promise.all([sb.from('profiles').select('*').order('created_at',{ascending:false}).limit(40),sb.from('services').select('*').order('created_at',{ascending:false}).limit(40),sb.from('orders').select('*').order('created_at',{ascending:false}).limit(40)]); $('#adminUsers').innerHTML=(u.data||[]).map(x=>`<div class="row"><div><b>${x.display_name||x.username||x.id}</b><br><small>${x.role} • ${x.account_status}</small></div><div><button class="btn subtle" onclick="adminUser('${x.id}','banned')">Ban</button><button class="btn primary" onclick="adminUser('${x.id}','approved')">Approve</button></div></div>`).join(''); $('#adminServices').innerHTML=(s.data||[]).map(x=>`<div class="row"><div><b>${x.title}</b><br><small>${money(x.price_inr)} • ${x.status}</small></div><div><button class="btn subtle" onclick="adminService('${x.id}','rejected')">Reject</button><button class="btn primary" onclick="adminService('${x.id}','approved')">Approve</button></div></div>`).join(''); const total=(o.data||[]).reduce((a,b)=>a+(b.platform_commission_inr||0),0); $('#adminOrders').innerHTML=`<div class="game-card"><h3>${money(total)}</h3><p>Estimated platform commission in recorded orders.</p></div>`+(o.data||[]).map(x=>`<div class="row"><b>${money(x.amount_inr)}</b><small>${x.status}</small></div>`).join(''); }
async function adminUser(id,status){ const patch=status==='banned'?{account_status:'banned',is_banned:true}:{account_status:'approved',is_banned:false}; const {error}=await sb.from('profiles').update(patch).eq('id',id); toast(error?error.message:'User updated'); loadAdmin(); }
async function adminService(id,status){ const {error}=await sb.from('services').update({status}).eq('id',id); toast(error?error.message:'Service updated'); loadAdmin(); }

function boot(){ renderStatic(); wireNavigation(); $('#loader').classList.add('hidden'); if(!localStorage.stackops_lang) $('#languageModal').classList.remove('hidden'); initAuth().then(loadAll); route(location.hash.replace('#','')||'home'); }
window.addEventListener('load',()=>setTimeout(boot,650));
$('#themeBtn').onclick=()=>document.body.classList.toggle('light');
$('#saveLanguageBtn').onclick=()=>{localStorage.stackops_lang=$('#languageSelect').value; $('#languageModal').classList.add('hidden'); toast('Language saved: '+localStorage.stackops_lang)};
$('#authOpenBtn').onclick=()=>$('#authModal').classList.remove('hidden');
$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).classList.add('hidden'));
$('#signupBtn').onclick=signup; $('#loginBtn').onclick=login; $('#logoutBtn').onclick=logout;
$('#openSquadModal').onclick=()=>$('#squadModal').classList.remove('hidden'); $('#createSquadBtn').onclick=createSquad;
$('#openServiceModal').onclick=()=>$('#serviceModal').classList.remove('hidden'); $('#createServiceBtn').onclick=createService;
$('#createPostBtn').onclick=createPost; $('#sendChatBtn').onclick=sendChat;
$$('.channel').forEach(c=>c.onclick=()=>{$$('.channel').forEach(x=>x.classList.remove('active')); c.classList.add('active'); activeChannel=c.dataset.channel; loadChat();});
$('#squadSearch').oninput=()=>{ const q=$('#squadSearch').value.toLowerCase(); renderSquads(sample.squads.filter(s=>JSON.stringify(s).toLowerCase().includes(q))); };
window.buyPlan=buyPlan; window.buyService=buyService; window.adminUser=adminUser; window.adminService=adminService; window.toast=toast;
