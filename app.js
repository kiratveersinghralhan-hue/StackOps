const cfg = window.STACKOPS_CONFIG || {};
const isConfigured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR-PROJECT');
const supabase = isConfigured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

let currentUser = null;
let currentProfile = null;
let allProfiles = [];
let plans = [];
let services = [];
const $ = (id) => document.getElementById(id);
const qsa = (sel) => [...document.querySelectorAll(sel)];

const demoPlans = [
  {id:'starter', name:'Recruit Pass', price:199, badge_name:'Recruit+', title_reward:'Rising Recruit', features:['Profile frame','Basic squad boost','Starter badge']},
  {id:'elite', name:'Elite Pass', price:999, badge_name:'Elite', title_reward:'Elite Operator', features:['Animated badge','Priority discover','5 service boosts']},
  {id:'immortal', name:'Immortal Club', price:2999, badge_name:'Immortal', title_reward:'Immortal Flex', features:['Neon profile aura','Verified priority','Tournament perks']},
  {id:'radiant', name:'Radiant Partner', price:10000, badge_name:'Radiant Crown', title_reward:'Radiant Founder', features:['Crown badge','Top profile placement','Concierge support','Creator launch kit']}
];
const demoBadges = [
  {icon:'♛', name:'Admin Crown', rarity:'Mythic', description:'Only platform admins get this identity.'},
  {icon:'◆', name:'Verified Coach', rarity:'Epic', description:'Approved service provider or coach.'},
  {icon:'⚡', name:'Squad Hunter', rarity:'Rare', description:'Highly active teammate finder.'},
  {icon:'✦', name:'Founder', rarity:'Legendary', description:'Early supporter reward.'},
  {icon:'☄', name:'Radiant Crown', rarity:'Mythic', description:'₹10,000 premium title badge.'}
];

function toast(msg){
  const n=document.createElement('div'); n.className='toast'; n.textContent=msg; $('toast').appendChild(n); setTimeout(()=>n.remove(),3600);
}
function route(id){ qsa('.view').forEach(v=>v.classList.remove('active')); $(id)?.classList.add('active'); window.scrollTo({top:0,behavior:'smooth'}); if(id==='admin') renderAdmin(); }
qsa('[data-route]').forEach(b=>b.addEventListener('click',()=>route(b.dataset.route)));
qsa('[data-open-auth]').forEach(b=>b.addEventListener('click',()=>openAuth()));
$('themeBtn').onclick=()=>document.body.classList.toggle('low-motion');
function openAuth(){ $('authModal').classList.remove('hide'); }
$('closeAuth').onclick=()=>$('authModal').classList.add('hide');
$('authBtn').onclick=openAuth;

async function init(){
  animateBg();
  renderPlans(demoPlans); renderRewards(demoBadges);
  if(!supabase){ toast('Demo mode: add Supabase URL/key in config.js'); renderDemo(); return; }
  const { data:{ session } } = await supabase.auth.getSession();
  currentUser=session?.user || null;
  await afterAuthChange();
  supabase.auth.onAuthStateChange(async(_e,session)=>{ currentUser=session?.user||null; await afterAuthChange(); });
}
async function afterAuthChange(){
  $('authBtn').textContent=currentUser?'Account':'Login';
  $('profileBtn').classList.toggle('hide',!currentUser);
  if(currentUser){ await loadProfile(); await loadAll(); } else { currentProfile=null; renderDemo(); }
}
$('signupBtn').onclick=async()=>{
  if(!supabase) return toast('Connect Supabase first.');
  const email=$('email').value.trim(), password=$('password').value;
  const {error}=await supabase.auth.signUp({email,password});
  if(error) return toast(error.message);
  toast('Account created. Check email if confirmation is enabled.');
};
$('loginBtn').onclick=async()=>{
  if(!supabase) return toast('Connect Supabase first.');
  const email=$('email').value.trim(), password=$('password').value;
  const {error}=await supabase.auth.signInWithPassword({email,password});
  if(error) return toast(error.message);
  $('authModal').classList.add('hide'); toast('Logged in.');
};
$('logoutBtn').onclick=async()=>{ if(supabase){ await supabase.auth.signOut(); toast('Logged out.'); } };

async function loadProfile(){
  const {data,error}=await supabase.from('profiles').select('*').eq('id',currentUser.id).single();
  if(error){ toast('Profile loading issue: '+error.message); return; }
  currentProfile=data; fillProfileForm();
  const isAdmin=data.role==='admin';
  $('adminNav').classList.toggle('hide',!isAdmin);
  if(data.status==='banned') toast('Your account is banned. Contact admin.');
}
function fillProfileForm(){
  if(!currentProfile) return;
  $('displayName').value=currentProfile.display_name||''; $('riotId').value=currentProfile.riot_id||''; $('mainGame').value=currentProfile.main_game||'Valorant'; $('rank').value=currentProfile.rank||''; $('region').value=currentProfile.region||'India'; $('roleText').value=currentProfile.player_role||''; $('bioText').value=currentProfile.bio||'';
  $('dashName').textContent=currentProfile.display_name||currentUser.email;
  $('dashTitle').textContent=currentProfile.role==='admin'?'♛ ADMIN OVERLORD':(currentProfile.title||'Recruit');
  const img=currentProfile.avatar_url||avatarFallback(currentProfile.display_name||currentUser.email); $('dashAvatar').src=img; $('topAvatar').src=img;
  $('badgeStrip').innerHTML = `${currentProfile.role==='admin'?'<span class="badge admin">♛ Admin Crown</span>':''}<span class="badge">${currentProfile.badge_name||'Recruit'}</span><span class="badge">${currentProfile.status||'pending'}</span>`;
  $('myStatus').innerHTML=`<b>Status:</b> ${currentProfile.looking_for_squad?'Looking for squad':'Chilling'} · <b>Plan:</b> ${currentProfile.plan_name||'Free'} · <b>Verification:</b> ${currentProfile.verification_status||'unverified'}`;
}
$('saveProfileBtn').onclick=async()=>{
  if(!currentUser) return openAuth();
  const patch={display_name:$('displayName').value, riot_id:$('riotId').value, main_game:$('mainGame').value, rank:$('rank').value, region:$('region').value, player_role:$('roleText').value, bio:$('bioText').value, updated_at:new Date().toISOString()};
  const {error}=await supabase.from('profiles').update(patch).eq('id',currentUser.id);
  if(error) return toast(error.message); toast('Profile saved.'); await loadProfile(); await loadAll();
};
$('lookingBtn').onclick=async()=>{
  if(!currentProfile) return openAuth();
  const {error}=await supabase.from('profiles').update({looking_for_squad:!currentProfile.looking_for_squad}).eq('id',currentUser.id);
  if(error) return toast(error.message); await loadProfile(); toast('Squad status updated.');
};
$('avatarUpload').onchange=async(e)=>{
  if(!currentUser||!supabase) return openAuth();
  const file=e.target.files[0]; if(!file) return;
  const path=`${currentUser.id}/${Date.now()}-${file.name.replaceAll(' ','-')}`;
  const up=await supabase.storage.from('avatars').upload(path,file,{upsert:true});
  if(up.error) return toast(up.error.message);
  const {data}=supabase.storage.from('avatars').getPublicUrl(path);
  await supabase.from('profiles').update({avatar_url:data.publicUrl}).eq('id',currentUser.id);
  await loadProfile(); toast('Avatar uploaded.');
};
$('createPostBtn').onclick=async()=>{
  if(!currentUser) return openAuth();
  const body=prompt('Write a quick gamer status:'); if(!body) return;
  const {error}=await supabase.from('posts').insert({user_id:currentUser.id,body});
  if(error) return toast(error.message); toast('Post created.');
};

async function loadAll(){
  const [p,s,pl,b] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at',{ascending:false}).limit(100),
    supabase.from('services').select('*, profiles(display_name, avatar_url)').eq('status','approved').order('created_at',{ascending:false}).limit(60),
    supabase.from('plans').select('*').eq('is_active',true).order('price'),
    supabase.from('badges').select('*').order('sort_order')
  ]);
  allProfiles=p.data||[]; services=s.data||[]; plans=pl.data?.length?pl.data:demoPlans;
  renderPlayers(allProfiles); renderServices(services); renderPlans(plans); renderRewards(b.data?.length?b.data:demoBadges);
  $('mUsers').textContent=allProfiles.length; $('mServices').textContent=services.length;
}
function renderDemo(){
  const demoProfiles=[{display_name:'NeonAce',main_game:'Valorant',rank:'Diamond',region:'India',player_role:'Duelist',looking_for_squad:true,badge_name:'Elite',status:'approved'},{display_name:'SageSensei',main_game:'Valorant',rank:'Immortal',region:'SEA',player_role:'Coach',verification_status:'verified',badge_name:'Verified Coach',status:'approved'},{display_name:'RiftKing',main_game:'League of Legends',rank:'Platinum',region:'EU',player_role:'Jungler',badge_name:'Founder',status:'approved'}];
  renderPlayers(demoProfiles); renderServices([{title:'Valorant Aim Coaching',category:'Valorant Coaching',price:499,duration:'60 min',description:'Crosshair placement, routine, ranked mindset.',profiles:{display_name:'SageSensei'}}]);
  $('mUsers').textContent=demoProfiles.length; $('mServices').textContent=1;
}
function avatarFallback(name='P'){ return `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}`; }
function renderPlayers(list){
  const term=($('searchPlayers').value||'').toLowerCase();
  const filtered=list.filter(p=>JSON.stringify(p).toLowerCase().includes(term) && p.status!=='banned');
  $('playersGrid').innerHTML=filtered.map(p=>`<article class="card"><div class="pill-row"><span class="pill">${p.main_game||'Valorant'}</span><span class="pill">${p.region||'Global'}</span>${p.role==='admin'?'<span class="badge admin">♛ Admin</span>':''}</div><h3>${p.display_name||'Unnamed Player'}</h3><p class="muted">${p.riot_id||'Riot ID hidden'}</p><div class="pill-row"><span class="mini-badge">Rank: ${p.rank||'Unranked'}</span><span class="mini-badge">${p.player_role||'Flex'}</span><span class="mini-badge">${p.badge_name||'Recruit'}</span></div><p>${p.bio||'Ready to queue and make new gamer friends.'}</p><button class="primary full" onclick="invitePlayer('${p.id||''}')">Invite to Play</button></article>`).join('')||'<p class="muted">No players found.</p>';
}
$('searchPlayers').oninput=()=>renderPlayers(allProfiles.length?allProfiles:[]);
$('refreshPlayers').onclick=()=>supabase?loadAll():renderDemo();
window.invitePlayer=async(id)=>{
  if(!currentUser) return openAuth();
  if(!id) return toast('Demo invite sent.');
  const {error}=await supabase.from('invites').insert({from_user:currentUser.id,to_user:id,message:'Invite to play'});
  if(error) return toast(error.message); toast('Invite sent.');
};

$('openServiceForm').onclick=()=>$('serviceForm').classList.toggle('hide');
$('saveServiceBtn').onclick=async()=>{
  if(!currentUser) return openAuth();
  const row={provider_id:currentUser.id,title:$('serviceTitle').value,category:$('serviceCategory').value,price:+$('servicePrice').value,duration:$('serviceDuration').value,description:$('serviceDesc').value,status:'pending'};
  if(!row.title||!row.price) return toast('Add title and price.');
  const {error}=await supabase.from('services').insert(row);
  if(error) return toast(error.message); toast('Service submitted for admin approval.'); $('serviceForm').classList.add('hide');
};
function renderServices(list){
  $('servicesGrid').innerHTML=(list||[]).map(s=>`<article class="card"><div class="pill-row"><span class="pill">${s.category}</span><span class="pill">${s.duration||'Flexible'}</span></div><h3>${s.title}</h3><p class="muted">By ${s.profiles?.display_name||'Verified Provider'}</p><p>${s.description||''}</p><div class="price">₹${s.price}</div><button class="primary full" onclick="bookService('${s.id||''}',${s.price||0})">Book / Request</button><small class="muted">Platform commission: ${cfg.COMMISSION_RATE||15}%</small></article>`).join('')||'<p class="muted">No approved services yet.</p>';
}
window.bookService=async(id,price)=>{
  if(!currentUser) return openAuth();
  if(!id) return toast('Demo booking created.');
  const commission=Math.round(price*((cfg.COMMISSION_RATE||15)/100));
  const {error}=await supabase.from('bookings').insert({service_id:id,buyer_id:currentUser.id,amount:price,commission_amount:commission,status:'pending_payment'});
  if(error) return toast(error.message); toast('Booking request created. Add payment gateway/UPI verification next.');
};
function renderPlans(list){
  $('plansGrid').innerHTML=list.map((p,i)=>`<article class="plan ${i===list.length-1?'featured':''}"><h3>${p.name}</h3><p class="muted">${p.title_reward||'Premium title'} · ${p.badge_name||'Badge'}</p><div class="price">₹${p.price}</div><div class="pill-row">${(p.features||[]).map(f=>`<span class="pill">${f}</span>`).join('')}</div><button class="primary full" onclick="requestPlan('${p.id}',${p.price},'${p.name}')">Choose Plan</button></article>`).join('');
}
window.requestPlan=async(id,price,name)=>{
  if(!currentUser) return openAuth();
  if(!supabase) return toast('Demo plan selected.');
  const {error}=await supabase.from('plan_orders').insert({user_id:currentUser.id,plan_id:id,amount:price,status:'pending_verification',payment_note:'Manual verification / payment gateway placeholder'});
  if(error) return toast(error.message); toast(`${name} request sent to admin for verification.`);
};
function renderRewards(list){
  $('rewardsGrid').innerHTML=list.map(b=>`<article class="card"><div class="crown">${b.icon||'◆'}</div><h3>${b.name}</h3><p class="pill">${b.rarity||'Common'}</p><p class="muted">${b.description||''}</p></article>`).join('');
}

async function renderAdmin(tab='users'){
  if(!currentProfile || currentProfile.role!=='admin'){ $('adminContent').innerHTML='<p class="muted">Admin only. Set your profile role to admin in Supabase.</p>'; return; }
  qsa('.tab').forEach(t=>{t.onclick=()=>renderAdmin(t.dataset.adminTab); t.classList.toggle('active',t.dataset.adminTab===tab);});
  if(tab==='users'){
    const {data}=await supabase.from('profiles').select('*').order('created_at',{ascending:false}).limit(200);
    $('adminContent').innerHTML=`<table class="table"><tr><th>User</th><th>Status</th><th>Plan</th><th>Role</th><th>Actions</th></tr>${(data||[]).map(u=>`<tr><td>${u.display_name||u.email||u.id}<br><small>${u.riot_id||''}</small></td><td>${u.status}</td><td>${u.plan_name||'Free'}</td><td>${u.role}</td><td><button class="success" onclick="adminUser('${u.id}','approved')">Approve</button> <button class="danger" onclick="adminUser('${u.id}','banned')">Ban</button> <button class="ghost" onclick="makeAdmin('${u.id}')">Make Admin</button></td></tr>`).join('')}</table>`;
  }
  if(tab==='payments'){
    const {data}=await supabase.from('plan_orders').select('*, profiles(display_name), plans(name,badge_name,title_reward)').order('created_at',{ascending:false}).limit(100);
    $('adminContent').innerHTML=`<table class="table"><tr><th>User</th><th>Plan</th><th>Amount</th><th>Status</th><th>Actions</th></tr>${(data||[]).map(o=>`<tr><td>${o.profiles?.display_name||o.user_id}</td><td>${o.plans?.name||o.plan_id}</td><td>₹${o.amount}</td><td>${o.status}</td><td><button class="success" onclick="verifyPlan('${o.id}','${o.user_id}','${o.plan_id}')">Verify</button> <button class="danger" onclick="rejectPlan('${o.id}')">Reject</button></td></tr>`).join('')}</table>`;
  }
  if(tab==='services'){
    const {data}=await supabase.from('services').select('*, profiles(display_name)').order('created_at',{ascending:false}).limit(100);
    $('adminContent').innerHTML=`<table class="table"><tr><th>Service</th><th>Provider</th><th>Price</th><th>Status</th><th>Actions</th></tr>${(data||[]).map(s=>`<tr><td>${s.title}<br><small>${s.category}</small></td><td>${s.profiles?.display_name||s.provider_id}</td><td>₹${s.price}</td><td>${s.status}</td><td><button class="success" onclick="serviceStatus('${s.id}','approved')">Approve</button> <button class="danger" onclick="serviceStatus('${s.id}','rejected')">Reject</button></td></tr>`).join('')}</table>`;
  }
  if(tab==='badges') $('adminContent').innerHTML='<div class="panel glass"><h3>Badge system</h3><p class="muted">Add/edit badges directly in Supabase table <b>badges</b>. The frontend reads them automatically.</p></div>';
}
window.adminUser=async(id,status)=>{ const {error}=await supabase.from('profiles').update({status}).eq('id',id); if(error)return toast(error.message); toast('User updated.'); renderAdmin('users'); };
window.makeAdmin=async(id)=>{ const {error}=await supabase.from('profiles').update({role:'admin',title:'ADMIN OVERLORD',badge_name:'Admin Crown',status:'approved'}).eq('id',id); if(error)return toast(error.message); toast('Admin crown granted.'); renderAdmin('users'); };
window.serviceStatus=async(id,status)=>{ const {error}=await supabase.from('services').update({status}).eq('id',id); if(error)return toast(error.message); toast('Service updated.'); renderAdmin('services'); };
window.rejectPlan=async(id)=>{ const {error}=await supabase.from('plan_orders').update({status:'rejected'}).eq('id',id); if(error)return toast(error.message); toast('Plan rejected.'); renderAdmin('payments'); };
window.verifyPlan=async(orderId,userId,planId)=>{
  const {data:plan}=await supabase.from('plans').select('*').eq('id',planId).single();
  const e1=await supabase.from('plan_orders').update({status:'verified',verified_by:currentUser.id,verified_at:new Date().toISOString()}).eq('id',orderId);
  if(e1.error)return toast(e1.error.message);
  const e2=await supabase.from('profiles').update({plan_id:planId,plan_name:plan.name,badge_name:plan.badge_name,title:plan.title_reward,status:'approved'}).eq('id',userId);
  if(e2.error)return toast(e2.error.message);
  toast('Plan verified and rewards applied.'); renderAdmin('payments');
};

function animateBg(){
  const c=$('bg-canvas'),x=c.getContext('2d'); let w,h,pts=[];
  function resize(){w=c.width=innerWidth;h=c.height=innerHeight;pts=Array.from({length:70},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.4}))} resize(); addEventListener('resize',resize);
  function frame(){x.clearRect(0,0,w,h); x.fillStyle='rgba(0,229,255,.55)'; pts.forEach((p,i)=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1;x.beginPath();x.arc(p.x,p.y,1.8,0,7);x.fill(); for(let j=i+1;j<pts.length;j++){const q=pts[j],d=Math.hypot(p.x-q.x,p.y-q.y); if(d<130){x.strokeStyle=`rgba(139,92,246,${1-d/130})`;x.beginPath();x.moveTo(p.x,p.y);x.lineTo(q.x,q.y);x.stroke();}}}); requestAnimationFrame(frame)} frame();
}
init();
