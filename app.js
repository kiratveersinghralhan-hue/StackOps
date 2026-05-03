const cfg = window.STACKOPS_CONFIG || {};
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
let sb = null;
let session = null;
let me = null;
let currentChannel = 'global';
let voiceJoined = false;
const adminEmails = (cfg.ADMIN_EMAILS || []).map((e) => e.toLowerCase());

const demo = {
  teams: [
    { id:'t1', name:'Immortal Scrim', game:'Valorant', region:'Mumbai', rank:'Immortal+', description:'Need Duelist + Smokes. Serious comms only.', owner_id:'demo' },
    { id:'t2', name:'Clash Flex', game:'League of Legends', region:'EUW', rank:'Gold+', description:'Jungle + Mid needed for weekly Clash.', owner_id:'demo' },
    { id:'t3', name:'TFT Lab', game:'Teamfight Tactics', region:'SEA', rank:'Diamond+', description:'Comp testing, chill voice, no toxicity.', owner_id:'demo' },
    { id:'t4', name:'Premier Tryouts', game:'Valorant', region:'Singapore', rank:'Ascendant+', description:'Looking for sentinel and IGL.', owner_id:'demo' }
  ],
  posts: [
    { id:'p1', username:'RazeMain', content:'Need Premier 5 stack tonight. Mumbai server. Drop role + rank.', image_url:'', created_at:new Date().toISOString() },
    { id:'p2', username:'CoachByte', content:'Opened 3 VOD review slots. First 10 minutes free for StackOps users.', image_url:'', created_at:new Date().toISOString() },
    { id:'p3', username:'StackOps', content:'New collectible banner unlocked: Crownline Protocol.', image_url:'', created_at:new Date().toISOString() }
  ],
  services: [
    { title:'Valorant Aim Coaching', description:'1 hour aim routine + VOD notes', price_inr:399, status:'approved' },
    { title:'Duo Rank Strategy', description:'Macro, agent pool and comm review', price_inr:999, status:'approved' },
    { title:'Team Scrim Analysis', description:'Full team VOD review + PDF plan', price_inr:2499, status:'approved' },
    { title:'Pro Trial Bootcamp', description:'3-day structured improvement plan', price_inr:5999, status:'approved' }
  ],
  titles: ['Rookie','Clutch Maker','Spike Caller','Aim Architect','Lobby Captain','Radiant Mind','Founder'],
  badges: ['Starter Spark','Duelist Flame','Strategist Core','Squad Builder','Verified Coach','Origin Crown'],
  banners: [
    { key:'default', name:'Default Arena Card', desc:'Clean black/white StackOps card', style:'linear-gradient(135deg,#151922,#30343d)' },
    { key:'redline', name:'Redline Protocol', desc:'Valorant-inspired red accent', style:'linear-gradient(135deg,#0b0d12,#ff4655 120%)' },
    { key:'ion', name:'Ion Pulse', desc:'Electric blue premium card', style:'linear-gradient(135deg,#0b0d12,#55f2ff 130%)' },
    { key:'gold', name:'Crownline', desc:'Founder-grade gold identity', style:'linear-gradient(135deg,#0a0a0c,#ffd166 135%)' },
    { key:'shadow', name:'Shadow Ops', desc:'Minimal black tactical card', style:'linear-gradient(135deg,#050608,#20242c)' },
    { key:'rift', name:'Rift Walker', desc:'Riot universe all-games card', style:'linear-gradient(135deg,#14151c,#7b61ff 130%)' }
  ]
};

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => t.classList.remove('show'), 2600);
}

function money(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function commission(amount) {
  const rule = (cfg.COMMISSION_RULES || []).find(r => amount >= r.min && amount <= r.max) || {percent: 20};
  return Math.round(amount * rule.percent / 100);
}
function initials(name='OP') { return name.split(/\s|_/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('') || 'OP'; }
function isAdmin() { return !!(me?.role === 'admin' || adminEmails.includes(session?.user?.email?.toLowerCase() || '')); }
function needLogin() { if (!session) { $('#authModal').classList.add('active'); toast('Login required for this action'); return true; } return false; }

function initSupabase() {
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.includes('YOUR_')) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
}

async function init() {
  setTimeout(() => $('#boot')?.classList.add('hide'), 650);
  if (localStorage.stackopsLang) $('#languageModal')?.classList.remove('active');
  initSupabase();
  wireUI();
  renderAll();
  animateCounters();
  if (sb) {
    const { data } = await sb.auth.getSession();
    session = data.session;
    if (session) await loadMe();
    sb.auth.onAuthStateChange(async (_event, s) => { session = s; me = null; if (s) await loadMe(); else updateProfileUI(); });
    subscribeRealtime();
  } else {
    updateProfileUI();
  }
}

function wireUI() {
  $('#saveLanguage').onclick = () => { localStorage.stackopsLang = $('#languageSelect').value; $('#languageModal').classList.remove('active'); };
  $('#hamb').onclick = () => $('#mobileMenu').classList.toggle('open');
  $('#themeToggle').onclick = () => { document.body.classList.toggle('light'); localStorage.stackopsTheme = document.body.classList.contains('light') ? 'light' : 'dark'; };
  if (localStorage.stackopsTheme === 'light') document.body.classList.add('light');
  $$('.nav').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  $('#openAuth').onclick = () => session ? logout() : $('#authModal').classList.add('active');
  $('#closeAuth').onclick = () => $('#authModal').classList.remove('active');
  $$('[data-close]').forEach(b => b.onclick = () => $('#' + b.dataset.close).classList.remove('active'));
  $('#loginBtn').onclick = login;
  $('#signupBtn').onclick = signup;
  $('#profileForm').addEventListener('submit', saveProfile);
  $('#newTeamBtn').onclick = () => needLogin() ? null : $('#teamModal').classList.add('active');
  $('#teamForm').addEventListener('submit', createTeam);
  $('#quickMatchBtn').onclick = () => { switchView('chat'); toast('Quick match room opened'); };
  $('#createPostBtn').onclick = createPost;
  $('#sendMsgBtn').onclick = sendMessage;
  $('#messageInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
  $$('.channel').forEach(c => c.onclick = () => setChannel(c.dataset.channel));
  $('#applySellerBtn').onclick = applySeller;
  $('#voiceBtn').onclick = joinVoice;
  $('#muteBtn').onclick = () => toast('Muted preview');
  $('#leaveVoiceBtn').onclick = leaveVoice;
  $('#equipFounder').onclick = equipFounderKit;
  $('#scrollTop').onclick = () => window.scrollTo({top:0, behavior:'smooth'});
  window.addEventListener('scroll', () => $('#scrollTop').classList.toggle('show', scrollY > 420));
}

function switchView(id) {
  if (!id) return;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === id));
  $$('.nav').forEach(n => n.classList.toggle('active', n.dataset.view === id));
  $('#mobileMenu').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (id === 'chat') loadMessages();
  if (id === 'admin') renderAdmin();
}

async function login() {
  if (!sb) return toast('Add Supabase URL and anon key in config.js');
  const email = $('#email').value.trim();
  const password = $('#password').value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return toast(error.message);
  $('#authModal').classList.remove('active');
  toast('Logged in');
}
async function signup() {
  if (!sb) return toast('Add Supabase URL and anon key in config.js');
  const email = $('#email').value.trim();
  const password = $('#password').value;
  const { error } = await sb.auth.signUp({ email, password });
  if (error) return toast(error.message);
  toast('Signup complete. Check email if confirmation is enabled.');
}
async function logout() { if (sb) await sb.auth.signOut(); session = null; me = null; toast('Logged out'); updateProfileUI(); }

async function loadMe() {
  if (!sb || !session) return;
  const email = session.user.email?.toLowerCase() || '';
  let { data } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (!data) {
    const profile = { id: session.user.id, username: email.split('@')[0], display_name: email.split('@')[0], role: adminEmails.includes(email) ? 'admin' : 'user', account_status: 'approved', title: adminEmails.includes(email) ? 'Founder' : 'Rookie', badge: adminEmails.includes(email) ? 'Origin Crown' : 'Starter Spark' };
    await sb.from('profiles').insert(profile);
    data = profile;
  }
  me = data;
  fillAccountForm();
  updateProfileUI();
  renderAdmin();
}

function fillAccountForm() {
  $('#displayName').value = me?.display_name || '';
  $('#username').value = me?.username || '';
  $('#riotId').value = me?.riot_id || '';
  $('#gender').value = me?.gender || '';
  $('#mainGame').value = me?.main_game || 'Valorant';
  $('#bio').value = me?.bio || '';
}

function updateProfileUI() {
  const admin = isAdmin();
  $$('.admin-only').forEach(x => x.classList.toggle('hidden', !admin));
  $('#openAuth').textContent = session ? 'Logout' : 'Login';
  const name = me?.display_name || me?.username || 'Guest Player';
  const title = admin ? 'Founder • Crownline Control' : (me?.title || 'Rookie • Login to claim identity');
  $('#heroName').textContent = name;
  $('#heroTitle').textContent = title;
  $('#heroAvatar').textContent = initials(name);
  if (me?.avatar_url) $('#heroAvatar').style.backgroundImage = `url(${me.avatar_url})`;
  $('#heroCrown').classList.toggle('hidden', !admin);
  $('#founderRibbon').classList.toggle('hidden', !admin);
  $('#profilePreview').classList.toggle('admin', admin);
  const selected = demo.banners.find(b => b.key === (me?.selected_banner_key || localStorage.stackopsBanner)) || (admin ? demo.banners[3] : demo.banners[0]);
  $('#heroBannerName').textContent = selected.name;
  $('#heroBannerPreview').style.background = selected.style;
  $('#teamCounter').textContent = (JSON.parse(localStorage.stackopsTeams || '[]').length + demo.teams.length);
  $('#badgeCounter').textContent = admin ? 6 : 2;
  $('#levelFill').style.width = admin ? '100%' : '46%';
  renderAccountPreview();
}

async function uploadFile(bucket, file, folder='uploads') {
  if (!file || !sb || !session) return '';
  const path = `${session.user.id}/${folder}-${Date.now()}-${file.name.replace(/\s+/g,'-')}`;
  const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) { toast(error.message); return ''; }
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function saveProfile(e) {
  e.preventDefault();
  if (needLogin()) return;
  const avatarUrl = await uploadFile(cfg.STORAGE_BUCKETS?.avatars || 'avatars', $('#avatarFile').files[0], 'avatar');
  const bannerUrl = await uploadFile(cfg.STORAGE_BUCKETS?.banners || 'banners', $('#bannerFile').files[0], 'banner');
  const patch = {
    display_name: $('#displayName').value.trim(), username: $('#username').value.trim(), riot_id: $('#riotId').value.trim(), gender: $('#gender').value, main_game: $('#mainGame').value, bio: $('#bio').value.trim(), updated_at: new Date().toISOString()
  };
  if (avatarUrl) patch.avatar_url = avatarUrl;
  if (bannerUrl) patch.custom_banner_url = bannerUrl;
  if (sb) await sb.from('profiles').update(patch).eq('id', session.user.id);
  me = { ...me, ...patch };
  updateProfileUI();
  toast('Profile saved');
}

function renderAll() {
  renderTeams(); renderPosts(); renderServices(); renderRewards(); renderQuests(); loadMessages(); updateProfileUI();
}
function renderTeams() {
  const local = JSON.parse(localStorage.stackopsTeams || '[]');
  const teams = [...local, ...demo.teams];
  $('#hotTeams').innerHTML = teams.slice(0,3).map(teamCard).join('');
  $('#teamList').innerHTML = teams.map(teamCard).join('');
}
function teamCard(t) {
  const canDelete = t.owner_id === session?.user?.id || t.local;
  return `<article class="team-card"><span class="tag">${t.game}</span><h3>${t.name}</h3><p>${t.description || ''}</p><small>${t.region || 'Global'} • ${t.rank || 'Any rank'}</small><div class="actions"><button class="btn primary full" onclick="joinTeam('${t.name.replace(/'/g,"\\'")}')">Join Lobby</button>${canDelete ? `<button class="btn dark full" onclick="deleteTeam('${t.id}')">Delete Team</button>` : ''}</div></article>`;
}
async function createTeam(e) {
  e.preventDefault();
  if (needLogin()) return;
  const team = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name: $('#teamName').value.trim(), game: $('#teamGame').value, region: $('#teamRegion').value.trim(), rank: $('#teamRank').value.trim(), description: $('#teamDescription').value.trim(), owner_id: session.user.id, local:true };
  if (sb) await sb.from('teams').insert({ owner_id: session.user.id, name: team.name, game: team.game, region: team.region, rank_required: team.rank, description: team.description }).catch(()=>{});
  const local = JSON.parse(localStorage.stackopsTeams || '[]'); local.unshift(team); localStorage.stackopsTeams = JSON.stringify(local);
  $('#teamModal').classList.remove('active'); $('#teamForm').reset(); renderTeams(); updateProfileUI(); toast('Team created');
}
window.deleteTeam = async (id) => {
  const local = JSON.parse(localStorage.stackopsTeams || '[]').filter(t => t.id !== id); localStorage.stackopsTeams = JSON.stringify(local);
  if (sb) await sb.from('teams').delete().eq('id', id).catch(()=>{});
  renderTeams(); updateProfileUI(); toast('Team deleted');
};
window.joinTeam = (name) => { switchView('chat'); setChannel('team-room'); toast(`Joined ${name}`); };

function renderPosts() {
  const local = JSON.parse(localStorage.stackopsPosts || '[]');
  const posts = [...local, ...demo.posts];
  $('#miniFeed').innerHTML = posts.slice(0,4).map(p => `<div class="feed-item"><b>@${p.username || 'player'}</b><br>${p.content}</div>`).join('');
  $('#postList').innerHTML = posts.map(p => `<article class="post-card"><b>@${p.username || 'player'}</b><small>${new Date(p.created_at || Date.now()).toLocaleString()}</small>${p.image_url ? `<img src="${p.image_url}" alt="Post image" style="width:100%;border-radius:16px;margin:12px 0;max-height:360px;object-fit:cover">` : ''}<p>${p.content}</p><div class="post-actions"><button class="mini" onclick="toast('GG sent')">GG</button><button class="mini" onclick="toast('Invite opened')">Invite</button><button class="mini" onclick="toast('Saved')">Save</button></div></article>`).join('');
}
async function createPost() {
  if (needLogin()) return;
  const content = $('#postContent').value.trim();
  if (!content) return toast('Write something first');
  const imageUrl = await uploadFile(cfg.STORAGE_BUCKETS?.posts || 'posts', $('#postImage').files[0], 'post');
  const post = { id:String(Date.now()), username:me?.username || 'player', content, image_url:imageUrl, created_at:new Date().toISOString(), user_id:session.user.id };
  if (sb) await sb.from('posts').insert({ user_id: session.user.id, content, image_url: imageUrl }).catch(()=>{});
  const local = JSON.parse(localStorage.stackopsPosts || '[]'); local.unshift(post); localStorage.stackopsPosts = JSON.stringify(local);
  $('#postContent').value=''; $('#postImage').value=''; renderPosts(); toast('Post published');
}

function renderServices() {
  $('#serviceList').innerHTML = demo.services.map(s => `<article class="service-card"><span class="tag">Admin approved</span><h3>${s.title}</h3><p>${s.description}</p><h2>${money(s.price_inr)}</h2><small>Commission: ${money(commission(s.price_inr))}</small><button class="btn primary full" onclick="buy('${s.title.replace(/'/g,"\\'")}',${s.price_inr})">Book Now</button></article>`).join('');
  const gmv = demo.services.reduce((a,s) => a + s.price_inr * 19, 0);
  $('#gmvCounter').textContent = money(gmv);
}
async function applySeller() {
  if (needLogin()) return;
  if (sb) await sb.from('seller_applications').insert({ user_id: session.user.id, status:'pending' }).catch(()=>{});
  toast('Seller application sent for admin approval');
}
window.buy = (name, amount) => {
  if (needLogin()) return;
  if (!window.Razorpay || !cfg.RAZORPAY_KEY_ID || cfg.RAZORPAY_KEY_ID.includes('YOUR_')) return toast(`Razorpay test key needed. Demo: ${name} ${money(amount)}`);
  new Razorpay({ key:cfg.RAZORPAY_KEY_ID, amount:amount*100, currency:'INR', name:'StackOps', description:name, handler:async (res)=>{ if(sb) await sb.from('payments').insert({ buyer_id:session.user.id, amount_inr:amount, commission_inr:commission(amount), provider:'razorpay', provider_payment_id:res.razorpay_payment_id, status:'paid' }).catch(()=>{}); toast('Payment success'); }}).open();
};

function renderRewards() {
  $('#titleCollection').innerHTML = demo.titles.map(t => rewardCard('title', t, (me?.title||'Rookie') === t)).join('');
  $('#badgeCollection').innerHTML = demo.badges.map((b,i) => rewardCard('badge', b, i < (isAdmin()?6:2))).join('');
  const banners = demo.banners.map(b => bannerCard(b, (me?.selected_banner_key || localStorage.stackopsBanner || 'default') === b.key)).join('');
  $('#bannerCollection').innerHTML = banners;
  $('#rewardBannerCollection').innerHTML = banners;
}
function rewardCard(type, name, unlocked) { return `<button class="reward-card ${unlocked?'equipped':'locked'}" onclick="equipReward('${type}','${name.replace(/'/g,"\\'")}')"><b>${name}</b><small>${unlocked?'Unlocked':'Locked — earn XP'}</small></button>`; }
function bannerCard(b, active) { return `<button class="banner-card ${active?'active':''}" style="background:${b.style}" onclick="equipBanner('${b.key}')"><b>${b.name}</b><small>${b.desc}</small></button>`; }
window.equipReward = async (type, name) => {
  if (needLogin()) return;
  const patch = type === 'title' ? { title:name } : { badge:name };
  if (sb) await sb.from('profiles').update(patch).eq('id', session.user.id).catch(()=>{});
  me = { ...me, ...patch }; renderRewards(); updateProfileUI(); toast(`${name} equipped`);
};
window.equipBanner = async (key) => {
  if (needLogin()) return;
  localStorage.stackopsBanner = key;
  if (sb) await sb.from('profiles').update({ selected_banner_key:key }).eq('id', session.user.id).catch(()=>{});
  me = { ...me, selected_banner_key:key }; renderRewards(); updateProfileUI(); toast('Banner equipped');
};
function renderAccountPreview() {
  const name = me?.display_name || me?.username || 'Guest Player';
  $('#accountPreview').innerHTML = `<div class="profile-row"><div class="avatar">${initials(name)}</div><div><h3>${name}</h3><p>${isAdmin()?'Founder':(me?.title||'Rookie')}</p></div>${isAdmin()?'<span class="crown">👑</span>':''}</div><p>${me?.bio || 'No bio yet. Add one from profile settings.'}</p>`;
  renderRewards();
}
async function equipFounderKit() {
  if (!isAdmin()) return toast('Founder only');
  const patch = { title:'Founder', badge:'Origin Crown', selected_banner_key:'gold', is_verified:true };
  if (sb && session) await sb.from('profiles').update(patch).eq('id', session.user.id).catch(()=>{});
  me = { ...me, ...patch }; renderRewards(); updateProfileUI(); toast('Founder kit equipped');
}

function renderQuests() {
  const quests = ['Complete profile +100 XP','Create or join a team +80 XP','Publish one community post +60 XP','Enter a voice room +40 XP','Apply as seller +150 XP'];
  $('#questList').innerHTML = quests.map((q,i)=>`<div class="quest"><b>${q}</b><button class="mini" onclick="toast('Quest tracked')">${i?'Start':'Claim'}</button></div>`).join('');
}
function setChannel(channel) {
  currentChannel = channel;
  $$('.channel').forEach(c => c.classList.toggle('active', c.dataset.channel === channel));
  $('#chatTitle').textContent = channel.startsWith('dm-') ? '@ ' + channel.replace('dm-','') : '# ' + channel;
  loadMessages();
}
async function loadMessages() {
  const box = $('#messages'); if (!box) return;
  box.innerHTML = '';
  if (sb) {
    const { data } = await sb.from('messages').select('*').eq('channel', currentChannel).order('created_at', { ascending:true }).limit(80).catch(()=>({data:null}));
    (data || []).forEach(m => appendMessage({ content:m.content, sender_name:m.sender_name || 'Player', channel:m.channel, me:m.sender_id === session?.user?.id }));
  }
  if (!box.children.length) ['Welcome to this room.','Drop rank, role and server.','Keep it clean. StackOps is competitive but respectful.'].forEach((x,i)=>appendMessage({sender_name:['ArenaBot','IGL','Mod'][i], content:x, channel:currentChannel}));
}
function appendMessage(m) {
  const el = document.createElement('div');
  el.className = 'message' + (m.me ? ' me' : '');
  el.innerHTML = `<small>${m.sender_name || 'Player'} • ${m.channel || currentChannel}</small>${escapeHtml(m.content)}`;
  $('#messages').appendChild(el);
  $('#messages').scrollTop = $('#messages').scrollHeight;
}
async function sendMessage() {
  if (needLogin()) return;
  const content = $('#messageInput').value.trim(); if (!content) return;
  $('#messageInput').value = '';
  appendMessage({ sender_name:me?.username || 'me', content, channel:currentChannel, me:true });
  if (sb) await sb.from('messages').insert({ sender_id:session.user.id, sender_name:me?.username || me?.display_name || 'Player', channel:currentChannel, content }).catch(()=>{});
}
function subscribeRealtime() {
  if (!sb) return;
  sb.channel('stackops-live').on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' }, payload => {
    const m = payload.new;
    if (m.channel === currentChannel && m.sender_id !== session?.user?.id) appendMessage({ sender_name:m.sender_name || 'Player', content:m.content, channel:m.channel });
  }).subscribe();
}
function joinVoice() { if (needLogin()) return; voiceJoined = true; $('#voiceRoom').classList.remove('hidden'); $('#voiceStatus').textContent = 'Connected preview'; toast('Voice room joined'); }
function leaveVoice() { voiceJoined = false; $('#voiceRoom').classList.add('hidden'); toast('Left voice room'); }

async function renderAdmin() {
  if (!isAdmin()) return;
  if (!sb) { $('#adminUsers').innerHTML = '<p>Add Supabase keys to manage real users.</p>'; $('#adminSellers').innerHTML = '<p>Seller approvals appear here.</p>'; return; }
  const users = (await sb.from('profiles').select('id,username,role,account_status,is_banned,is_verified').limit(30).catch(()=>({data:[]}))).data || [];
  $('#adminUsers').innerHTML = users.map(u => `<div class="user-row"><b>${u.username || u.id.slice(0,8)}</b><small>${u.role} • ${u.account_status || 'approved'} • ${u.is_banned?'banned':'active'}</small><button class="mini" onclick="adminUpdateUser('${u.id}','approved')">Approve</button><button class="mini" onclick="adminBan('${u.id}',${!u.is_banned})">${u.is_banned?'Unban':'Ban'}</button><button class="mini" onclick="adminVerify('${u.id}')">Verify</button></div>`).join('') || 'No users yet';
  const sellers = (await sb.from('seller_applications').select('*').limit(30).catch(()=>({data:[]}))).data || [];
  $('#adminSellers').innerHTML = sellers.map(s => `<div class="user-row"><b>${s.user_id?.slice(0,8) || 'seller'}</b><small>${s.status}</small><button class="mini" onclick="adminSeller('${s.id}','approved')">Approve</button><button class="mini" onclick="adminSeller('${s.id}','rejected')">Reject</button></div>`).join('') || 'No seller applications';
}
window.adminUpdateUser = async (id,status)=>{ await sb.from('profiles').update({ account_status:status }).eq('id', id); toast('User updated'); renderAdmin(); };
window.adminBan = async (id,banned)=>{ await sb.from('profiles').update({ is_banned:banned, account_status:banned?'banned':'approved' }).eq('id', id); toast('Ban status updated'); renderAdmin(); };
window.adminVerify = async (id)=>{ await sb.from('profiles').update({ is_verified:true }).eq('id', id); toast('User verified'); renderAdmin(); };
window.adminSeller = async (id,status)=>{ await sb.from('seller_applications').update({ status }).eq('id', id); toast('Seller updated'); renderAdmin(); };

function animateCounters() {
  let online = 2429;
  setInterval(() => { online += Math.floor(Math.random()*9 - 3); $('#onlineCounter').textContent = online.toLocaleString() + ' players online'; }, 2400);
  let xp = 0; const timer = setInterval(()=>{ xp += 41; $('#xpCounter').textContent = xp; if (xp >= 1258) { $('#xpCounter').textContent='1258'; clearInterval(timer); } }, 45);
}
function escapeHtml(str='') { return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
window.toast = toast;
document.addEventListener('DOMContentLoaded', init);
