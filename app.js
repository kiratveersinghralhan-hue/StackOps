const cfg = window.STACKOPS_CONFIG || {};
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
let sb = null;
let session = null;
let me = null;
let currentChannel = 'dm-founder';
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
  plans: [
    { key:'free', name:'Free', price_inr:0, desc:'Starter profile, squads, community and basic rewards' },
    { key:'bronze', name:'Bronze', price_inr:199, desc:'Starter premium badge + small profile boost' },
    { key:'silver', name:'Silver', price_inr:499, desc:'Silver title pack + priority squad visibility' },
    { key:'gold', name:'Gold', price_inr:999, desc:'Gold profile glow + marketplace discovery boost' },
    { key:'diamond', name:'Diamond', price_inr:2499, desc:'Elite banner pack + premium seller visibility' },
    { key:'legend', name:'Legend', price_inr:5999, desc:'Top-tier identity pack + highest profile boost' }
  ],
  titles: [
    {name:'Rookie', xp:0, desc:'Default title for every new player'},
    {name:'Clutch Maker', xp:250, desc:'Complete your first profile and squad action'},
    {name:'Spike Caller', xp:600, desc:'Create teams and invite players'},
    {name:'Aim Architect', xp:1200, desc:'Post, chat and complete community quests'},
    {name:'Lobby Captain', xp:2200, desc:'Build a team presence'},
    {name:'Radiant Mind', xp:4200, desc:'High trust competitive identity'},
    {name:'Founder', xp:999999, desc:'Founder only', adminOnly:true}
  ],
  badges: [
    {name:'Starter Spark', xp:0, desc:'Default badge for every new player'},
    {name:'First Queue', xp:150, desc:'Join your first squad or room'},
    {name:'Duelist Flame', xp:450, desc:'Active community player'},
    {name:'Strategist Core', xp:900, desc:'Useful teammate and communicator'},
    {name:'Squad Builder', xp:1600, desc:'Create teams and help others'},
    {name:'Verified Coach', xp:3000, desc:'Approved seller or coach'},
    {name:'Origin Crown', xp:999999, desc:'Founder/admin exclusive', adminOnly:true}
  ],
  banners: [
    { key:'default', name:'Starter Arena Card', xp:0, desc:'Default banner for every new player', style:'linear-gradient(135deg,#0f1117,#20242c)' },
    { key:'redline', name:'Redline Protocol', xp:350, desc:'Earn through early quests', style:'linear-gradient(135deg,#07080c 0%,#151922 55%,#ff4655 160%)' },
    { key:'ion', name:'Ion Pulse', xp:900, desc:'Chat and squad activity reward', style:'linear-gradient(135deg,#07080c 0%,#101820 55%,#55f2ff 160%)' },
    { key:'shadow', name:'Shadow Ops', xp:1600, desc:'Minimal tactical banner', style:'linear-gradient(135deg,#030406,#111827 70%,#3a3f4b)' },
    { key:'rift', name:'Rift Walker', xp:2600, desc:'All Riot games identity card', style:'linear-gradient(135deg,#08090f 0%,#171320 60%,#7b61ff 155%)' },
    { key:'gold', name:'Founder Crownline', xp:999999, desc:'Founder/admin exclusive', adminOnly:true, style:'linear-gradient(135deg,#050507 0%,#15100a 62%,#ffd166 150%)' }
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
function playerXP() { return isAdmin() ? 9999999 : Number(me?.xp || localStorage.stackopsXP || 0); }
function isUnlocked(item) { return isAdmin() || (!item.adminOnly && playerXP() >= Number(item.xp || 0)); }
function defaultProfileFor(email='') { const admin = adminEmails.includes(email.toLowerCase()); return { role: admin ? 'admin' : 'user', title: admin ? 'Founder' : 'Rookie', badge: admin ? 'Origin Crown' : 'Starter Spark', selected_banner_key: admin ? 'gold' : 'default', xp: admin ? 999999 : 0, account_status:'approved', is_verified:admin, is_banned:false }; }
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
  initSmoothReveal();
  animateCounters();

  if (sb) {
    try {
      const { data, error } = await sb.auth.getSession();
      if (error) console.warn('Session restore warning:', error.message);
      session = data?.session || null;
      if (session) await safeLoadMe();
      else updateProfileUI();

      sb.auth.onAuthStateChange(async (event, s) => {
        console.log('[StackOps auth]', event, !!s);
        session = s || null;
        if (session) await safeLoadMe();
        else { me = null; updateProfileUI(); }
        renderAllSafe();
      });
      subscribeRealtime();
    } catch (err) {
      console.error('Auth init error:', err);
      toast('Auth init error. Check config.js / browser console.');
      updateProfileUI();
    }
  } else {
    updateProfileUI();
  }

  renderAllSafe();
}


async function applySeller() {
  if (needLogin()) return;
  const alreadySeller = me?.is_seller === true || me?.seller_status === 'approved' || localStorage.stackopsSellerApproved === '1';
  if (alreadySeller) {
    toast('Seller account already active');
    switchView('market');
    return;
  }
  const btn = $('#applySellerBtn');
  const oldText = btn?.textContent || 'Apply to Sell';
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

  let submitted = false;
  if (sb && session) {
    try {
      // Do not fail the user if a duplicate request already exists.
      const { error } = await sb.from('seller_applications').insert({
        user_id: session.user.id,
        status: 'pending',
        note: 'Seller application submitted from StackOps marketplace'
      });
      if (!error) submitted = true;
      else console.warn('seller_applications insert:', error.message);
    } catch (err) {
      console.warn('Seller application failed:', err?.message || err);
    }
  }

  localStorage.stackopsSellerApplied = '1';
  toast(submitted ? 'Seller application submitted for admin approval' : 'Seller application saved locally. Admin can approve after DB sync.');
  refreshSellerButton();
  renderAdmin();
  if (btn) { btn.disabled = false; btn.textContent = oldText; }
}

function refreshSellerButton() {
  const btn = $('#applySellerBtn');
  if (!btn) return;
  const approved = me?.is_seller === true || me?.seller_status === 'approved' || localStorage.stackopsSellerApproved === '1';
  const pending = localStorage.stackopsSellerApplied === '1' || me?.seller_status === 'pending';
  if (approved) { btn.textContent = 'Seller Active'; btn.classList.remove('primary'); btn.classList.add('dark'); }
  else if (pending) { btn.textContent = 'Application Pending'; btn.classList.remove('primary'); btn.classList.add('dark'); }
  else { btn.textContent = 'Apply to Sell'; btn.classList.add('primary'); btn.classList.remove('dark'); }
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
  $('#sendMsgBtn') && ($('#sendMsgBtn').onclick = sendMessage);
  $('#messageInput') && $('#messageInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
  $$('.channel').forEach(c => c.onclick = () => setChannel(c.dataset.channel));
  $('#applySellerBtn').onclick = applySeller;
  $('#createVoiceRoomBtn') && ($('#createVoiceRoomBtn').onclick = createVoiceRoom);
  $('#muteBtn') && ($('#muteBtn').onclick = () => toast('Muted'));
  $('#leaveVoiceBtn') && ($('#leaveVoiceBtn').onclick = leaveVoice);
  $('#copyVoiceInviteBtn') && ($('#copyVoiceInviteBtn').onclick = copyVoiceInvite);
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
  if (id === 'voice') renderVoicePage();
  if (id === 'admin') renderAdmin();
}


function renderAllSafe() {
  try { renderAll(); } catch (err) { console.error('Render error:', err); updateProfileUI(); }
}

async function safeLoadMe() {
  try {
    await loadMe();
  } catch (err) {
    console.error('Profile load error:', err);
    const email = session?.user?.email?.toLowerCase() || '';
    const fallback = defaultProfileFor(email);
    me = {
      id: session?.user?.id,
      email,
      username: email ? email.split('@')[0] : 'player',
      display_name: email ? email.split('@')[0] : 'Player',
      ...fallback
    };
    updateProfileUI();
    toast('Logged in. Profile table needs SQL/policy check.');
  }
}

async function login(e) {
  if (e?.preventDefault) e.preventDefault();
  if (!sb) return toast('Add Supabase URL and anon key in config.js');
  const email = $('#email')?.value?.trim()?.toLowerCase();
  const password = $('#password')?.value;
  if (!email || !password) return toast('Enter email and password');

  const btn = $('#loginBtn');
  const oldText = btn?.textContent || 'Login';
  if (btn) { btn.disabled = true; btn.textContent = 'Logging in...'; }

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('Supabase login error:', error);
      const msg = /confirm|verified|verification/i.test(error.message)
        ? 'Email not verified. Confirm your email in inbox or disable email confirmation in Supabase Auth for testing.'
        : error.message;
      toast(msg);
      return;
    }

    const restored = await sb.auth.getSession();
    session = data?.session || restored?.data?.session || null;
    if (!session) {
      toast('Login succeeded but session was not saved. Check Supabase Auth Site URL and allowed redirect URLs.');
      return;
    }

    // Show logged-in UI immediately, even if profile table/RLS has an issue.
    const fallback = defaultProfileFor(email);
    me = {
      id: session.user.id,
      email,
      username: email.split('@')[0],
      display_name: email.split('@')[0],
      ...fallback,
      ...(me || {})
    };
    $('#authModal')?.classList.remove('active');
    updateProfileUI();
    toast('Logged in successfully');

    await safeLoadMe();
    updateProfileUI();
    renderAllSafe();
  } catch (err) {
    console.error('Login failed:', err);
    toast('Login failed. Open browser console for details.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = oldText; }
  }
}

async function signup(e) {
  if (e?.preventDefault) e.preventDefault();
  if (!sb) return toast('Add Supabase URL and anon key in config.js');
  const email = $('#email')?.value?.trim()?.toLowerCase();
  const password = $('#password')?.value;
  if (!email || !password) return toast('Enter email and password');
  const btn = $('#signupBtn');
  const oldText = btn?.textContent || 'Signup';
  if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }
  try {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) return toast(error.message);
    if (data?.session) {
      session = data.session;
      await safeLoadMe();
      $('#authModal')?.classList.remove('active');
      updateProfileUI();
      renderAllSafe();
      toast('Account created and logged in');
    } else {
      toast('Signup complete. Check email if confirmation is enabled, then login.');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = oldText; }
  }
}

async function logout() { if (sb) await sb.auth.signOut(); session = null; me = null; localStorage.removeItem('stackopsXP'); toast('Logged out'); updateProfileUI(); renderAllSafe(); }

async function loadMe() {
  if (!sb || !session) return;
  const email = session.user.email?.toLowerCase() || '';
  let { data } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (!data) {
    const profile = { id: session.user.id, username: email.split('@')[0], display_name: email.split('@')[0], ...defaultProfileFor(email) };
    await sb.from('profiles').upsert(profile, { onConflict: 'id' }).catch(()=>{});
    data = profile;
  }
  me = { ...defaultProfileFor(email), ...data };
  if (!me.title || !me.badge || !me.selected_banner_key) {
    const patch = defaultProfileFor(email);
    await sb.from('profiles').update({ title: me.title || patch.title, badge: me.badge || patch.badge, selected_banner_key: me.selected_banner_key || patch.selected_banner_key, xp: me.xp ?? patch.xp }).eq('id', session.user.id).catch(()=>{});
    me = { ...patch, ...me };
  }
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
  refreshSellerButton();
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
  if (e?.preventDefault) e.preventDefault();
  if (needLogin()) return;
  const name = $('#teamName')?.value?.trim();
  if (!name) return toast('Enter a team name');
  const team = {
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    name,
    game: $('#teamGame')?.value || 'Valorant',
    region: $('#teamRegion')?.value?.trim() || 'Global',
    rank: $('#teamRank')?.value?.trim() || 'Any rank',
    description: $('#teamDescription')?.value?.trim() || 'Looking for teammates',
    owner_id: session.user.id,
    local:true,
    created_at:new Date().toISOString()
  };

  // Always show immediately, even if Supabase table/RLS has a problem.
  const local = JSON.parse(localStorage.stackopsTeams || '[]');
  local.unshift(team);
  localStorage.stackopsTeams = JSON.stringify(local);

  if (sb) {
    try {
      const { error } = await sb.from('teams').insert({
        id: team.id,
        owner_id: session.user.id,
        name: team.name,
        game: team.game,
        region: team.region,
        rank_required: team.rank,
        description: team.description
      });
      if (error) console.warn('Team sync failed:', error.message);
    } catch (err) { console.warn('Team sync failed:', err?.message || err); }
  }
  $('#teamModal')?.classList.remove('active');
  $('#teamForm')?.reset();
  renderTeams(); updateProfileUI(); if (typeof refreshTrueCounters === 'function') refreshTrueCounters(); toast('Team created');
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
  const content = $('#postContent')?.value?.trim();
  if (!content) return toast('Write something first');
  const imageUrl = await uploadFile(cfg.STORAGE_BUCKETS?.posts || 'posts', $('#postImage')?.files?.[0], 'post');
  const post = {
    id:(crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    username:me?.username || me?.display_name || 'player',
    content,
    image_url:imageUrl,
    created_at:new Date().toISOString(),
    user_id:session.user.id,
    local:true
  };

  // Always show immediately, even if Supabase table/RLS has a problem.
  const local = JSON.parse(localStorage.stackopsPosts || '[]');
  local.unshift(post);
  localStorage.stackopsPosts = JSON.stringify(local);

  if (sb) {
    try {
      const { error } = await sb.from('posts').insert({ id: post.id, user_id: session.user.id, content, image_url: imageUrl });
      if (error) console.warn('Post sync failed:', error.message);
    } catch (err) { console.warn('Post sync failed:', err?.message || err); }
  }
  if ($('#postContent')) $('#postContent').value='';
  if ($('#postImage')) $('#postImage').value='';
  renderPosts(); if (typeof refreshTrueCounters === 'function') refreshTrueCounters(); toast('Post published');
}

function renderServices() {
  renderPlans();
  $('#serviceList').innerHTML = demo.services.map(s => `<article class="service-card"><span class="tag">Admin approved</span><h3>${s.title}</h3><p>${s.description}</p><h2>${money(s.price_inr)}</h2><small>Platform commission: ${money(commission(s.price_inr))}</small><button class="btn primary full" onclick="buy('${s.title.replace(/'/g,"\\'")}',${s.price_inr},'service')">Book Now</button></article>`).join('');
  refreshPaymentGMV();
  refreshSellerButton();
}

function renderPlans() {
  const el = $('#planList');
  if (!el) return;
  el.innerHTML = demo.plans.map(plan => `<article class="plan-card"><span class="tag">${plan.name}</span><h3>${plan.name}</h3><p>${plan.desc}</p><h2>${money(plan.price_inr)}</h2><button class="btn ${plan.price_inr ? 'primary' : 'dark'} full" onclick="buyPlan('${plan.key}')">${plan.price_inr ? 'Buy Plan' : 'Use Free'}</button></article>`).join('');
}

async function refreshPaymentGMV(){
  const demoGmv = demo.services.reduce((a,s) => a + s.price_inr * 19, 0);
  let total = demoGmv;
  if (sb) {
    try {
      const { data } = await sb.from('payments').select('amount_inr,status');
      if (data?.length) total = data.filter(p => p.status === 'paid' || p.status === 'captured').reduce((a,p)=>a+Number(p.amount_inr||0),0);
    } catch(e) {}
  }
  $('#gmvCounter') && ($('#gmvCounter').textContent = money(total));
}

window.buyPlan = async (planKey) => {
  const plan = demo.plans.find(p => p.key === planKey);
  if (!plan) return toast('Plan not found');
  if (plan.price_inr <= 0) return toast('Free plan is already available');
  return startRazorpayCheckout({ name:`StackOps ${plan.name} Plan`, amount:plan.price_inr, type:'plan', plan_key:plan.key });
};

window.buy = (name, amount, type='service') => startRazorpayCheckout({ name, amount, type });

async function startRazorpayCheckout({ name, amount, type='service', plan_key=null }) {
  if (needLogin()) return;
  if (!amount || amount < 1) return toast('Invalid amount');

  const paymentRow = {
    buyer_id: session.user.id,
    amount_inr: amount,
    commission_inr: commission(amount),
    provider: 'razorpay',
    status: 'created',
    item_name: name,
    item_type: type,
    plan_key
  };

  let localPaymentId = null;
  if (sb) {
    try {
      const { data } = await sb.from('payments').insert(paymentRow).select('id').single();
      localPaymentId = data?.id || null;
    } catch (err) {
      console.warn('Payment pre-record failed:', err?.message || err);
    }
  }

  const keyMissing = !window.Razorpay || !cfg.RAZORPAY_KEY_ID || cfg.RAZORPAY_KEY_ID.includes('YOUR_');
  if (keyMissing) {
    const link = cfg.RAZORPAY_PAYMENT_LINK || 'https://razorpay.me/';
    toast('Razorpay key missing. Opening payment link fallback.');
    window.open(link, '_blank');
    return;
  }

  const options = {
    key: cfg.RAZORPAY_KEY_ID,
    amount: Math.round(amount * 100),
    currency: 'INR',
    name: cfg.RAZORPAY_BUSINESS_NAME || 'StackOps',
    description: name,
    image: 'stackops-luxury-logo.webp',
    notes: { stackops_payment_id: localPaymentId || '', stackops_user_id: session.user.id, item_type: type, plan_key: plan_key || '', item_name: name },
    prefill: { email: session.user.email || cfg.RAZORPAY_CONTACT_EMAIL || '' },
    theme: { color: '#ff4655' },
    handler: async (res) => {
      // IMPORTANT: frontend success is not trusted for premium unlocks.
      // The Supabase Edge Function webhook verifies Razorpay signature and unlocks automatically.
      if (sb && localPaymentId) {
        try {
          await sb.from('payments').update({
            provider_payment_id: res.razorpay_payment_id,
            provider_order_id: res.razorpay_order_id || null,
            provider_signature: res.razorpay_signature || null,
            status: 'client_success',
            raw_response: res
          }).eq('id', localPaymentId);
        } catch (err) {
          console.warn('Payment client-success update failed:', err?.message || err);
        }
      }
      toast(`Payment received. Verifying unlock...`);
      await watchVerifiedUnlock(localPaymentId, { type, plan_key, amount });
      refreshPaymentGMV();
      updateProfileUI();
    },
    modal: { ondismiss: async () => {
      if (sb && localPaymentId) await sb.from('payments').update({ status:'cancelled' }).eq('id', localPaymentId).catch(()=>{});
      toast('Payment cancelled');
    }}
  };

  try {
    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function(resp){
      console.warn('Razorpay failed:', resp?.error);
      toast(resp?.error?.description || 'Payment failed. Opening payment link fallback.');
      if (cfg.RAZORPAY_PAYMENT_LINK) window.open(cfg.RAZORPAY_PAYMENT_LINK, '_blank');
    });
    rzp.open();
  } catch (err) {
    console.warn('Razorpay open failed:', err?.message || err);
    toast('Checkout could not open. Opening payment link.');
    if (cfg.RAZORPAY_PAYMENT_LINK) window.open(cfg.RAZORPAY_PAYMENT_LINK, '_blank');
  }
}


async function watchVerifiedUnlock(paymentId, meta={}) {
  if (!sb || !paymentId) {
    toast('Payment done. Auto-unlock needs Supabase webhook setup.');
    return;
  }
  const maxSeconds = Number(cfg.PAYMENT_VERIFY_POLL_SECONDS || 45);
  const started = Date.now();
  while ((Date.now() - started) < maxSeconds * 1000) {
    try {
      const { data } = await sb.from('payments').select('status, verified_at, plan_key, item_type').eq('id', paymentId).single();
      if (data && ['captured','verified','unlocked'].includes(data.status)) {
        await safeLoadMe().catch(()=>{});
        await awardXP(80, 'Verified payment reward').catch(()=>{});
        toast(meta.type === 'plan' ? 'Premium plan unlocked!' : 'Payment verified!');
        renderPlans();
        updateProfileUI();
        return;
      }
    } catch (err) { console.warn('payment verify poll:', err?.message || err); }
    await new Promise(r => setTimeout(r, 3000));
  }
  toast('Payment recorded. Unlock will appear after Razorpay webhook verifies it.');
}

function renderRewards() {
  const currentTitle = isAdmin() ? (me?.title || 'Founder') : (me?.title || 'Rookie');
  const currentBadge = isAdmin() ? (me?.badge || 'Origin Crown') : (me?.badge || 'Starter Spark');
  $('#titleCollection').innerHTML = demo.titles.map(t => rewardCard('title', t, currentTitle === t.name)).join('');
  $('#badgeCollection').innerHTML = demo.badges.map(b => rewardCard('badge', b, currentBadge === b.name)).join('');
  const activeKey = (me?.selected_banner_key || localStorage.stackopsBanner || (isAdmin() ? 'gold' : 'default'));
  const banners = demo.banners.map(b => bannerCard(b, activeKey === b.key)).join('');
  const bannerEl = $('#bannerCollection');
  if (bannerEl) bannerEl.innerHTML = banners;
  const rewardBannerEl = $('#rewardBannerCollection');
  if (rewardBannerEl) rewardBannerEl.innerHTML = banners;
}
function rewardCard(type, item, equipped) {
  const unlocked = isUnlocked(item);
  const founder = item.adminOnly ? ' founder-lock' : '';
  return `<button class="reward-card ${equipped?'equipped':''} ${unlocked?'':'locked'}${founder}" onclick="equipReward('${type}','${item.name.replace(/'/g,"\\'")}')"><b>${item.name}</b><small>${unlocked ? (equipped?'Equipped':'Unlocked') : (item.adminOnly?'Founder only':`Locked — ${item.xp} XP`)}</small><em>${item.desc || ''}</em></button>`;
}
function bannerCard(b, active) {
  const unlocked = isUnlocked(b);
  return `<button class="banner-card ${active?'active':''} ${unlocked?'':'locked'} ${b.adminOnly?'founder-lock':''}" style="background:${b.style}" onclick="equipBanner('${b.key}')"><b>${b.name}</b><small>${unlocked ? b.desc : (b.adminOnly ? 'Founder only' : `Unlock at ${b.xp} XP`)}</small></button>`;
}
window.equipReward = async (type, name) => {
  if (needLogin()) return;
  const item = (type === 'title' ? demo.titles : demo.badges).find(x => x.name === name);
  if (!item || !isUnlocked(item)) return toast(item?.adminOnly ? 'Founder exclusive' : 'Locked — complete quests to unlock');
  const patch = type === 'title' ? { title:name } : { badge:name };
  if (sb) await sb.from('profiles').update(patch).eq('id', session.user.id).catch(()=>{});
  me = { ...me, ...patch }; renderRewards(); updateProfileUI(); toast(`${name} equipped`);
};
window.equipBanner = async (key) => {
  if (needLogin()) return;
  const item = demo.banners.find(x => x.key === key);
  if (!item || !isUnlocked(item)) return toast(item?.adminOnly ? 'Founder banner is admin only' : 'Banner locked — earn XP first');
  localStorage.stackopsBanner = key;
  if (sb) await sb.from('profiles').update({ selected_banner_key:key }).eq('id', session.user.id).catch(()=>{});
  me = { ...me, selected_banner_key:key }; renderRewards(); updateProfileUI(); toast('Banner equipped');
};
function renderAccountPreview() {
  const name = me?.display_name || me?.username || 'Guest Player';
  const badge = isAdmin() ? 'Origin Crown' : (me?.badge || 'Starter Spark');
  const title = isAdmin() ? 'Founder' : (me?.title || 'Rookie');
  $('#accountPreview').innerHTML = `<div class="profile-row"><div class="avatar">${initials(name)}</div><div><h3>${name}</h3><p>${title} • ${badge}</p><small>${playerXP().toLocaleString()} XP</small></div>${isAdmin()?'<span class="crown">👑</span>':''}</div><p>${me?.bio || 'No bio yet. Add one from profile settings.'}</p>`;
  renderRewards();
}
async function equipFounderKit() {
  if (!isAdmin()) return toast('Founder only');
  const patch = { title:'Founder', badge:'Origin Crown', selected_banner_key:'gold', is_verified:true, xp:999999 };
  if (sb && session) await sb.from('profiles').update(patch).eq('id', session.user.id).catch(()=>{});
  me = { ...me, ...patch }; renderRewards(); updateProfileUI(); toast('Founder kit equipped');
}

function renderQuests() {
  const quests = [
    {name:'Complete profile', xp:100},
    {name:'Create or join a team', xp:80},
    {name:'Publish one community post', xp:60},
    {name:'Enter a voice room', xp:40},
    {name:'Apply as seller', xp:150},
    {name:'Invite a teammate', xp:120}
  ];
  $('#questList').innerHTML = quests.map((q,i)=>`<div class="quest"><b>${q.name} <span>+${q.xp} XP</span></b><button class="mini" onclick="claimQuest(${q.xp}, '${q.name.replace(/'/g,"\'")}')">${i?'Start':'Claim'}</button></div>`).join('');
}
window.claimQuest = async (xp, name) => {
  if (needLogin()) return;
  if (isAdmin()) return toast('Founder has all rewards unlocked');
  const current = Number(me?.xp || localStorage.stackopsXP || 0);
  const next = current + Number(xp || 0);
  localStorage.stackopsXP = next;
  if (sb) await sb.from('profiles').update({ xp: next }).eq('id', session.user.id).catch(()=>{});
  me = { ...me, xp: next };
  renderRewards(); updateProfileUI(); renderAccountPreview();
  toast(`${name}: +${xp} XP`);
};
function setChannel(channel) {
  currentChannel = channel;
  $$('.channel').forEach(c => c.classList.toggle('active', c.dataset.channel === channel));
  const label = channel.startsWith('dm-') ? '@ ' + channel.replace('dm-','') : '# ' + channel;
  $('#chatTitle') && ($('#chatTitle').textContent = label);
  $('#activeConversationLabel') && ($('#activeConversationLabel').textContent = label.replace('@ ', '').replace('# ', ''));
  $('#chatSubline') && ($('#chatSubline').textContent = channel.startsWith('dm-') ? 'Direct message • online' : 'Public group chat • live room');
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
  const msgBox = $('#messages'); if (!msgBox) return;
  msgBox.appendChild(el);
  msgBox.scrollTop = msgBox.scrollHeight;
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
function joinVoice(roomName='Voice Room') {
  if (needLogin()) return;
  voiceJoined = true;
  localStorage.stackopsActiveVoice = roomName;
  renderVoicePage();
  toast('Joined ' + roomName);
}
function leaveVoice() {
  voiceJoined = false;
  localStorage.removeItem('stackopsActiveVoice');
  renderVoicePage();
  toast('Left voice room');
}
function voiceRooms(){
  const base = [
    {id:'v-global', name:'Global Open VC', privacy:'public', online:12, topic:'Open community voice'},
    {id:'v-valorant', name:'Valorant Stack VC', privacy:'public', online:8, topic:'Find teammates and scrims'},
    {id:'v-coach', name:'Coach Review Room', privacy:'private', online:2, topic:'Invite-only coaching'},
    {id:'v-team', name:'Team Private VC', privacy:'private', online:5, topic:'Private squad comms'}
  ];
  const custom = JSON.parse(localStorage.stackopsVoiceRooms || '[]');
  return [...custom, ...base];
}
function renderVoicePage(){
  const pub = $('#publicVoiceRooms'), priv = $('#privateVoiceRooms');
  if(!pub || !priv) return;
  const active = localStorage.stackopsActiveVoice || '';
  const card = r => `<article class="voice-room-card ${active===r.name?'active':''}"><div><b>${r.privacy==='private'?'🔒':'🌐'} ${escapeHtml(r.name)}</b><small>${escapeHtml(r.topic || 'Voice room')} • ${r.online || 1} online</small></div><div class="voice-actions"><button class="mini" onclick="joinVoiceById('${escapeHtml(r.id)}')">${active===r.name?'Connected':'Join'}</button><button class="mini" onclick="copySpecificVoiceInvite('${escapeHtml(r.id)}')">Invite</button></div></article>`;
  pub.innerHTML = voiceRooms().filter(r=>r.privacy==='public').map(card).join('');
  priv.innerHTML = voiceRooms().filter(r=>r.privacy==='private').map(card).join('');
  const activeBox = $('#activeVoiceCard');
  if(active){
    activeBox?.classList.remove('hidden');
    $('#activeVoiceName') && ($('#activeVoiceName').textContent = active);
    $('#activeVoiceStatus') && ($('#activeVoiceStatus').textContent = 'Connected • mic preview only. Use your device/Discord/WhatsApp call for real audio until WebRTC is added.');
  } else {
    activeBox?.classList.add('hidden');
  }
}
function createVoiceRoom(){
  if(needLogin()) return;
  const name = ($('#voiceRoomName')?.value || '').trim();
  if(!name) return toast('Enter room name');
  const privacy = $('#voiceRoomPrivacy')?.value || 'public';
  const id = 'voice-' + Date.now();
  const arr = JSON.parse(localStorage.stackopsVoiceRooms || '[]');
  arr.unshift({id,name,privacy,online:1,topic: privacy==='private' ? 'Private invite room' : 'Public voice room'});
  localStorage.stackopsVoiceRooms = JSON.stringify(arr);
  $('#voiceRoomName').value = '';
  renderVoicePage();
  toast('Voice room created');
}
function copyVoiceInvite(){
  const active = localStorage.stackopsActiveVoice || 'voice';
  navigator.clipboard?.writeText(`${location.origin}${location.pathname}?voice=${encodeURIComponent(active)}`);
  toast('Voice invite copied');
}
window.joinVoiceById = function(id){ const room = voiceRooms().find(r => r.id === id); if(room) joinVoice(room.name); };
window.copySpecificVoiceInvite = function(id){ navigator.clipboard?.writeText(`${location.origin}${location.pathname}?voice=${encodeURIComponent(id)}`); toast('Voice invite copied'); };
window.joinVoice = joinVoice;

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
window.adminSeller = async (id,status)=>{
  if (!sb) return toast('Supabase not connected');
  const { data: app } = await sb.from('seller_applications').select('user_id').eq('id', id).maybeSingle().catch(()=>({data:null}));
  await sb.from('seller_applications').update({ status }).eq('id', id).catch(()=>{});
  if (app?.user_id && status === 'approved') {
    await sb.from('profiles').update({ is_seller:true, seller_status:'approved', is_verified:true }).eq('id', app.user_id).catch(()=>{});
  }
  if (app?.user_id && status === 'rejected') {
    await sb.from('profiles').update({ is_seller:false, seller_status:'rejected' }).eq('id', app.user_id).catch(()=>{});
  }
  toast('Seller updated'); renderAdmin();
};

function initSmoothReveal() {
  const reveal = () => $$('.panel,.profile-card,.team-card,.post-card,.service-card,.reward-card,.banner-card').forEach((el,i)=>{
    if (!el.classList.contains('reveal')) { el.classList.add('reveal'); el.style.transitionDelay = Math.min(i * 18, 180) + 'ms'; }
  });
  reveal();
  const mo = new MutationObserver(reveal);
  mo.observe(document.body, { childList:true, subtree:true });
}

function animateCounters() {
  let online = 2429;
  setInterval(() => { online += Math.floor(Math.random()*9 - 3); $('#onlineCounter').textContent = online.toLocaleString() + ' players online'; }, 2400);
  let xp = 0; const timer = setInterval(()=>{ xp += 41; $('#xpCounter').textContent = xp; if (xp >= 1258) { $('#xpCounter').textContent='1258'; clearInterval(timer); } }, 45);
}
function escapeHtml(str='') { return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
window.toast = toast;


/* === StackOps Retention + Viral Upgrade Patch === */
const retention = {
  inviteMilestones:[
    {count:1,reward:'First Recruit badge',xp:120},
    {count:3,reward:'Redline Protocol banner',xp:350},
    {count:7,reward:'Squad Builder title',xp:900},
    {count:15,reward:'Shadow Ops banner',xp:1600},
    {count:30,reward:'Radiant Mind title',xp:3000}
  ],
  social:[
    'A new duelist joined the global lobby',
    'Someone unlocked Redline Protocol',
    'A coach application is waiting for approval',
    '3 players formed a ranked squad',
    'Founder Crownline active in the arena'
  ]
};
function getInviteCode(){
  if(!session?.user?.id) return '';
  return (me?.referral_code || session.user.id.slice(0,8)).toLowerCase();
}
function getInviteCount(){ return Number(me?.invite_count || localStorage.stackopsInvites || 0); }
function getStreak(){ return Number(me?.daily_streak || localStorage.stackopsStreak || 0); }
async function awardXP(xp, reason='XP earned'){
  if(!session || isAdmin()) { if(isAdmin()) toast('Founder already has all unlocks'); return; }
  const next = Number(me?.xp || localStorage.stackopsXP || 0) + Number(xp || 0);
  localStorage.stackopsXP = next;
  if(sb) await sb.from('profiles').update({xp:next}).eq('id', session.user.id).catch(()=>{});
  me = {...me, xp:next};
  renderRewards(); updateProfileUI(); renderAccountPreview(); renderRetention();
  celebrate(); toast(`${reason}: +${xp} XP`);
}
function celebrate(){
  const wrap=document.createElement('div'); wrap.className='confetti';
  for(let i=0;i<22;i++){ const c=document.createElement('i'); c.style.left=(Math.random()*100)+'vw'; c.style.animationDelay=(Math.random()*180)+'ms'; c.style.transform=`rotate(${Math.random()*180}deg)`; wrap.appendChild(c); }
  document.body.appendChild(wrap); setTimeout(()=>wrap.remove(),1100);
}
function renderRetention(){
  const inviteInput = $('#inviteLink');
  if(inviteInput){
    const code=getInviteCode();
    inviteInput.value = code ? `${location.origin}${location.pathname}?ref=${code}` : 'Login to create your invite link';
  }
  const inv=getInviteCount();
  const mil=$('#inviteMilestones');
  if(mil) mil.innerHTML=retention.inviteMilestones.map(m=>`<div class="milestone ${inv>=m.count?'done':''}"><div><b>${m.count} invite${m.count>1?'s':''}</b><small>${m.reward} • +${m.xp} XP</small></div><span class="chip">${Math.min(inv,m.count)}/${m.count}</span></div>`).join('');
  const chip=$('#streakChip'); if(chip) chip.textContent=`Day ${getStreak()}`;
  const status=$('#dailyStatus');
  const today=new Date().toISOString().slice(0,10);
  if(status) status.textContent = localStorage.stackopsLastDaily===today ? 'Claimed today. Come back tomorrow for streak XP.' : 'Ready to claim. Streak rewards help unlock banners faster.';
  const btn=$('#claimDailyBtn'); if(btn) btn.textContent = localStorage.stackopsLastDaily===today ? 'Claimed Today' : 'Claim Daily Reward';
  const lb=$('#leaderboardList');
  if(lb){
    const rows=[
      {name:me?.username||me?.display_name||'You',xp:playerXP(),tag:isAdmin()?'Founder':'You'},
      {name:'VandalMind',xp:4200,tag:'Top IGL'},
      {name:'ClutchRift',xp:3180,tag:'Inviter'},
      {name:'SageOps',xp:2450,tag:'Coach'},
      {name:'NeonPath',xp:1770,tag:'Rising'}
    ].sort((a,b)=>b.xp-a.xp);
    lb.innerHTML=rows.map((r,i)=>`<div class="leader-row"><span class="leader-rank">${i+1}</span><div><b>${escapeHtml(r.name)}</b><small>${Number(r.xp||0).toLocaleString()} XP</small></div><span class="chip">${r.tag}</span></div>`).join('');
  }
  renderNextUnlock(); renderSocialProof();
}
function renderNextUnlock(){
  const box=$('#nextUnlockPanel'); if(!box) return;
  const xp=playerXP();
  const all=[...demo.titles.map(x=>({...x,type:'Title'})),...demo.badges.map(x=>({...x,type:'Badge'})),...demo.banners.map(x=>({...x,type:'Banner'}))].filter(x=>!x.adminOnly && Number(x.xp)>xp).sort((a,b)=>a.xp-b.xp);
  const next=all[0];
  if(!next){ box.innerHTML='<div class="unlock-card"><h3>All public rewards unlocked</h3><p class="muted">Keep building your rep and invite players.</p></div>'; return; }
  const pct=Math.max(3, Math.min(100, Math.round((xp/next.xp)*100)));
  box.innerHTML=`<div class="unlock-card"><span class="eyebrow">Next ${next.type}</span><h3>${next.name}</h3><p class="muted">${next.desc || 'Unlock by staying active.'}</p><small>${xp.toLocaleString()} / ${next.xp.toLocaleString()} XP</small><div class="progress-track"><i style="width:${pct}%"></i></div></div>`;
}
function renderSocialProof(){
  const box=$('#socialProofList'); if(!box) return;
  box.innerHTML=retention.social.map((x,i)=>`<div class="feed-item"><b>${i%2?'⚡':'🔥'} Live</b><br>${x}</div>`).join('');
}
async function claimDailyReward(){
  if(needLogin()) return;
  const today=new Date().toISOString().slice(0,10);
  if(localStorage.stackopsLastDaily===today) return toast('Daily reward already claimed');
  const streak=getStreak()+1;
  localStorage.stackopsLastDaily=today; localStorage.stackopsStreak=streak;
  if(sb) await sb.from('daily_checkins').insert({user_id:session.user.id, checkin_date:today, xp_awarded:80 + (streak*10)}).catch(()=>{});
  if(sb) await sb.from('profiles').update({daily_streak:streak,last_daily_claim:today}).eq('id',session.user.id).catch(()=>{});
  me={...me,daily_streak:streak,last_daily_claim:today};
  await awardXP(80 + (streak*10), `Daily streak day ${streak}`);
}
function copyInvite(){
  if(needLogin()) return;
  const val=$('#inviteLink')?.value || '';
  navigator.clipboard?.writeText(val).then(()=>toast('Invite link copied')).catch(()=>toast(val));
}
function processReferral(){
  const ref=new URLSearchParams(location.search).get('ref');
  if(ref) localStorage.stackopsRef=ref;
}
const __oldWireUI = wireUI;
wireUI = function(){
  __oldWireUI();
  $('#copyInviteBtn') && ($('#copyInviteBtn').onclick=copyInvite);
  $('#claimDailyBtn') && ($('#claimDailyBtn').onclick=claimDailyReward);
};
const __oldRenderAll = renderAll;
renderAll = function(){ __oldRenderAll(); renderRetention(); };
const __oldLoadMe = loadMe;
loadMe = async function(){
  await __oldLoadMe();
  const email=session?.user?.email?.toLowerCase()||'';
  const patch={};
  if(!me?.referral_code) patch.referral_code=session.user.id.slice(0,8).toLowerCase();
  if(me?.daily_streak==null) patch.daily_streak=0;
  if(Object.keys(patch).length && sb) await sb.from('profiles').update(patch).eq('id',session.user.id).catch(()=>{});
  me={...me,...patch};
  // Referral capture: simple safe insert; duplicate prevented by SQL unique index.
  const ref=localStorage.stackopsRef;
  if(ref && sb && ref !== patch.referral_code){
    await sb.from('referrals').insert({referral_code:ref, invited_user_id:session.user.id}).catch(()=>{});
    localStorage.removeItem('stackopsRef');
  }
  renderRetention();
};
const __oldLogout = logout;
logout = async function(){ if(sb) await sb.auth.signOut(); session=null; me=null; updateProfileUI(); renderRetention(); toast('Logged out'); };
// reward actions get automatic XP
const __oldCreatePost = createPost;
createPost = async function(){ const before=JSON.parse(localStorage.stackopsPosts||'[]').length; await __oldCreatePost(); const after=JSON.parse(localStorage.stackopsPosts||'[]').length; if(after>before) await awardXP(25,'Community post'); };
const __oldCreateTeam = createTeam;
createTeam = async function(e){ await __oldCreateTeam(e); if(session && !isAdmin()) await awardXP(35,'Team created'); };
const __oldSendMessage = sendMessage;
sendMessage = async function(){ const had=$('#messageInput')?.value.trim(); await __oldSendMessage(); if(had && session && !isAdmin()){ const last=Number(localStorage.stackopsLastChatXP||0); if(Date.now()-last>60000){ localStorage.stackopsLastChatXP=Date.now(); await awardXP(5,'Chat activity'); }} };
const __oldJoinTeam = window.joinTeam;
window.joinTeam = function(name){ __oldJoinTeam(name); if(session && !isAdmin()) awardXP(15,'Joined squad'); };
processReferral();

document.addEventListener('DOMContentLoaded', init);

/* === StackOps Growth Command Final Patch === */
(function(){
  const liveFallback = [
    {kind:'join', text:'New player joined the arena', user:'RazeMain'},
    {kind:'unlock', text:'Unlocked Redline Protocol banner', user:'VandalMind'},
    {kind:'team', text:'Created a public squad for Valorant', user:'ClutchRift'},
    {kind:'seller', text:'Coach application is pending review', user:'CoachByte'},
    {kind:'voice', text:'Entered a voice room', user:'SageOps'}
  ];
  let liveEvents = JSON.parse(localStorage.stackopsLiveEvents || '[]');
  let lastShownXP = null;

  function safeNum(n){ return Number(n || 0); }
  function pulse(el){ if(!el) return; el.classList.remove('counter-pulse'); void el.offsetWidth; el.classList.add('counter-pulse'); }
  function xpDelta(amount){
    const delta = Number(amount || 0); if(!delta) return;
    const el = document.createElement('div');
    el.className = 'xp-float' + (delta < 0 ? ' neg' : '');
    el.textContent = `${delta > 0 ? '+' : ''}${delta} XP`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 1250);
  }
  function animateNumber(el, from, to, suffix=''){
    if(!el) return; from = safeNum(from); to = safeNum(to);
    const start = performance.now(); const dur = 520;
    function frame(t){
      const p = Math.min(1, (t-start)/dur); const eased = 1 - Math.pow(1-p, 3);
      el.textContent = Math.round(from + (to-from)*eased).toLocaleString('en-IN') + suffix;
      if(p < 1) requestAnimationFrame(frame); else pulse(el);
    }
    requestAnimationFrame(frame);
  }
  function addLiveEvent(text, user, kind='activity'){
    const ev = { text, user:user || me?.username || 'Player', kind, created_at:new Date().toISOString() };
    liveEvents.unshift(ev); liveEvents = liveEvents.slice(0, 18);
    localStorage.stackopsLiveEvents = JSON.stringify(liveEvents);
    renderLiveCenter();
    if(sb) sb.from('live_activity').insert({ user_id: session?.user?.id || null, username: ev.user, type:kind, content:text }).catch(()=>{});
  }
  window.addLiveEvent = addLiveEvent;

  function ensureLiveCenter(){
    const lobby = $('#lobby'); if(!lobby || $('#homeLiveCenter')) return;
    const anchor = lobby.querySelector('.dash-grid');
    const section = document.createElement('section');
    section.id = 'homeLiveCenter'; section.className = 'live-center reveal';
    section.innerHTML = `<div class="panel-head"><h2><span class="activity-dot"></span>Live Arena Center</h2><span class="chip" id="trueLiveChip">Realtime</span></div><div class="activity-rail" id="homeActivityRail"></div>`;
    if(anchor) anchor.parentNode.insertBefore(section, anchor); else lobby.appendChild(section);
  }
  function renderLiveCenter(){
    ensureLiveCenter();
    const rail = $('#homeActivityRail'); if(!rail) return;
    const rows = [...liveEvents, ...liveFallback].slice(0, 12);
    rail.innerHTML = rows.map(ev => `<div class="activity-pill"><b>@${escapeHtml(ev.user || 'Player')}</b><span>${escapeHtml(ev.text || ev.content || 'Joined StackOps')}</span><small>${new Date(ev.created_at || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</small></div>`).join('');
  }

  async function refreshTrueCounters(){
    const onlineEl = $('#onlineCounter');
    let players = 2428 + Math.floor(Math.random()*18);
    let teams = JSON.parse(localStorage.stackopsTeams || '[]').length + (demo?.teams?.length || 0);
    let posts = JSON.parse(localStorage.stackopsPosts || '[]').length + (demo?.posts?.length || 0);
    let sellers = 0;
    if(sb){
      const [p,t,po,s] = await Promise.all([
        sb.from('profiles').select('id', { count:'exact', head:true }).catch(()=>({count:null})),
        sb.from('teams').select('id', { count:'exact', head:true }).catch(()=>({count:null})),
        sb.from('posts').select('id', { count:'exact', head:true }).catch(()=>({count:null})),
        sb.from('seller_applications').select('id', { count:'exact', head:true }).catch(()=>({count:null}))
      ]);
      if(p.count != null) players = Math.max(players, p.count + 2400);
      if(t.count != null) teams = t.count;
      if(po.count != null) posts = po.count;
      if(s.count != null) sellers = s.count;
    }
    if(onlineEl) onlineEl.textContent = players.toLocaleString('en-IN') + ' players online';
    const hotSpan = [...document.querySelectorAll('.status-tape span')];
    if(hotSpan[1]) hotSpan[1].textContent = `${teams || 0} squads`;
    if(hotSpan[2]) hotSpan[2].textContent = `${Math.max(8, sellers || 0)} coaches`;
    pulse(onlineEl);
  }

  const oldUpdateProfileUI = updateProfileUI;
  updateProfileUI = function(){
    const before = lastShownXP;
    oldUpdateProfileUI();
    const now = playerXP();
    if(before !== null && now !== before) xpDelta(now - before);
    lastShownXP = now;
    const xpEl = $('#xpCounter');
    if(xpEl) animateNumber(xpEl, Number((xpEl.textContent || '0').replace(/,/g,'')), now);
    const fill = $('#levelFill'); if(fill && !isAdmin()) fill.style.width = Math.min(100, Math.round((now % 1000) / 10)) + '%';
    renderChallengeTracker();
  };

  const oldAwardXP = awardXP;
  awardXP = async function(xp, reason='XP earned'){
    const before = playerXP();
    await oldAwardXP(xp, reason);
    const after = playerXP();
    if(after !== before) { xpDelta(after-before); addLiveEvent(`${reason} (${after>before?'+':''}${after-before} XP)`, me?.username || me?.display_name || 'Player', 'xp'); }
    renderChallengeTracker();
  };

  function renderChallengeTracker(){
    const box = $('#questList'); if(!box) return;
    const xp = playerXP();
    const quests = [
      {name:'Complete profile', xp:100, target:'Add display name, Riot ID and bio', pct: me?.riot_id && me?.bio ? 100 : 35, action:'account'},
      {name:'Create or join a team', xp:80, target:'Find squad or create your own', pct: Math.min(100, (JSON.parse(localStorage.stackopsTeams||'[]').length)*100), action:'teams'},
      {name:'Publish one community post', xp:60, target:'Post LFT, clip, win or update', pct: JSON.parse(localStorage.stackopsPosts||'[]').length ? 100 : 0, action:'community'},
      {name:'Enter a voice room', xp:40, target:'Join voice preview room', pct: localStorage.stackopsVoiceJoined ? 100 : 0, action:'chat'},
      {name:'Apply as seller', xp:150, target:'Admin approval unlocks coaching sales', pct: localStorage.stackopsSellerApplied ? 100 : 0, action:'market'},
      {name:'Invite a teammate', xp:120, target:'Copy invite and bring one player', pct: Math.min(100, getInviteCount()*100), action:'lobby'}
    ];
    box.innerHTML = quests.map(q => `<div class="quest"><div><b>${q.name} <span>+${q.xp} XP</span></b><small>${q.target}</small><div class="progress-track"><i style="width:${q.pct}%"></i></div></div><button class="mini" onclick="window.questAction('${q.action}',${q.xp},'${q.name.replace(/'/g,"\\'")}')">${q.pct>=100?'Claim':'Start'}</button></div>`).join('');
  }
  window.questAction = async (view, xp, name) => { if(view) switchView(view); if(!session) return; if(name === 'Enter a voice room') localStorage.stackopsVoiceJoined = '1'; if(name === 'Apply as seller' && localStorage.stackopsSellerApplied) await awardXP(xp, name); else if(name === 'Complete profile' && me?.riot_id && me?.bio) await awardXP(xp, name); else toast('Complete the action first, then claim XP.'); };
  renderQuests = renderChallengeTracker;

  const oldRenderRetention = renderRetention;
  renderRetention = function(){
    oldRenderRetention();
    const h = document.querySelector('.invite-panel .panel-head h2'); if(h) h.innerHTML = '<span class="growth-title">Growth Network</span>';
    const tag = document.querySelector('.invite-panel .panel-head .chip'); if(tag) tag.textContent = 'Recruit rewards';
    const p = document.querySelector('.invite-panel .muted'); if(p) p.textContent = 'Recruit teammates, climb reputation boards and unlock rare identity collectibles.';
    const mil = $('#inviteMilestones');
    if(mil){
      const inv = getInviteCount();
      mil.innerHTML = retention.inviteMilestones.map(m=>`<div class="milestone ${inv>=m.count?'done':''}"><div><b>${m.count} recruit${m.count>1?'s':''}</b><small>${m.reward} · ${m.xp} XP reward</small></div><span class="chip">${Math.min(inv,m.count)}/${m.count}</span></div>`).join('');
    }
    renderChallengeTracker();
  };

  const oldRenderPosts = renderPosts;
  renderPosts = function(){
    const local = JSON.parse(localStorage.stackopsPosts || '[]');
    const posts = [...local, ...demo.posts.map((p,i)=>({...p, id:'demo-'+i, demo:true}))];
    const mini = $('#miniFeed');
    if(mini) mini.innerHTML = posts.slice(0,4).map(p => `<div class="feed-item"><b>@${escapeHtml(p.username || 'player')}</b><br>${escapeHtml(p.content)}<div class="feed-actions"><button class="mini nav" data-view="community">Open</button><button class="mini" onclick="switchView('teams')">Invite squad</button></div></div>`).join('');
    const list = $('#postList');
    if(list) list.innerHTML = posts.map(p => {
      const mine = !p.demo && (p.user_id === session?.user?.id || p.local || !p.user_id);
      return `<article class="post-card"><b>@${escapeHtml(p.username || 'player')}</b><small>${new Date(p.created_at || Date.now()).toLocaleString()}</small>${p.image_url ? `<img src="${p.image_url}" alt="Post image" style="width:100%;border-radius:16px;margin:12px 0;max-height:360px;object-fit:cover">` : ''}<p>${escapeHtml(p.content)}</p><div class="post-actions"><button class="mini" onclick="toast('GG sent')">GG</button><button class="mini" onclick="switchView('chat')">Join discussion</button><button class="mini" onclick="switchView('teams')">Invite</button>${mine ? `<button class="mini danger" onclick="deletePost('${p.id}')">Delete</button>` : ''}</div></article>`;
    }).join('');
  };
  window.deletePost = async function(id){
    const local = JSON.parse(localStorage.stackopsPosts || '[]');
    localStorage.stackopsPosts = JSON.stringify(local.filter(p => p.id !== id));
    if(sb && !String(id).startsWith('demo-')) await sb.from('posts').delete().eq('id', id).catch(()=>{});
    renderPosts(); addLiveEvent('Deleted a community post', me?.username || 'Player', 'post'); toast('Post deleted');
  };

  const oldCreatePost2 = createPost;
  createPost = async function(){
    const before = JSON.parse(localStorage.stackopsPosts || '[]').length;
    await oldCreatePost2();
    const after = JSON.parse(localStorage.stackopsPosts || '[]').length;
    if(after > before) addLiveEvent('Published a community post', me?.username || me?.display_name || 'Player', 'post');
  };

  const baseApplySeller = applySeller;
  applySeller = async function(){
    if(needLogin()) return;
    if(isAdmin()){
      switchView('admin');
      toast('Founder account already has seller/admin access. Normal users can apply here.');
      return;
    }
    await baseApplySeller();
    addLiveEvent('Submitted seller application', me?.username || 'Player', 'seller');
  };

  function getServers(){
    const base = [
      {id:'global', name:'Global Arena', visibility:'public', channel:'global'},
      {id:'valorant', name:'Valorant Scrims', visibility:'public', channel:'valorant'},
      {id:'marketplace', name:'Coach Market', visibility:'public', channel:'marketplace'},
      {id:'team-room', name:'Team Room', visibility:'private', channel:'team-room'}
    ];
    const custom = JSON.parse(localStorage.stackopsServers || '[]');
    return [...custom, ...base];
  }
  function renderDiscordServers(){
    const side = document.querySelector('.chat-sidebar'); if(!side) return;
    if(!$('#serverTools')){
      side.insertAdjacentHTML('afterbegin', `<h3>Servers</h3><div class="server-tools" id="serverTools"><input id="serverNameInput" placeholder="Create server"><select id="serverVis"><option value="public">Public</option><option value="private">Private</option></select><button class="mini" id="createServerBtn">Create</button></div><div class="server-list" id="serverList"></div>`);
      $('#createServerBtn').onclick = createServer;
    }
    const list = $('#serverList'); if(!list) return;
    list.innerHTML = getServers().map(s => `<button class="server-card ${currentChannel===s.channel?'active':''}" onclick="selectServer('${s.channel}')"><b>${s.visibility==='private'?'🔒':'🌐'} ${escapeHtml(s.name)}</b><small>${s.visibility} · share ${location.origin}${location.pathname}?server=${s.channel}</small></button>`).join('');
  }
  window.selectServer = function(channel){ setChannel(channel); renderDiscordServers(); };
  async function createServer(){
    if(needLogin()) return;
    const name = ($('#serverNameInput')?.value || '').trim(); if(!name) return toast('Enter server name');
    const visibility = $('#serverVis')?.value || 'public';
    const id = 'srv-' + Date.now(); const channel = id;
    const server = {id, name, visibility, channel, owner_id:session.user.id};
    const arr = JSON.parse(localStorage.stackopsServers || '[]'); arr.unshift(server); localStorage.stackopsServers = JSON.stringify(arr);
    if(sb) await sb.from('chat_servers').insert({id, owner_id:session.user.id, name, visibility, invite_code:id}).catch(()=>{});
    $('#serverNameInput').value = ''; renderDiscordServers(); selectServer(channel); addLiveEvent(`Created ${visibility} server: ${name}`, me?.username || 'Player', 'server'); toast('Server created');
  }
  const oldSetChannel = setChannel;
  setChannel = function(channel){ oldSetChannel(channel); renderDiscordServers(); };
  const oldLoadMessages = loadMessages;
  loadMessages = async function(){ await oldLoadMessages(); renderDiscordServers(); renderVoiceRooms(); };
  function renderVoiceRooms(){ renderVoicePage(); }
  window.joinVoiceRoom = function(name){ if(needLogin()) return; localStorage.stackopsVoiceJoined='1'; joinVoice(name); addLiveEvent(`Joined ${name}`, me?.username || 'Player', 'voice'); };

  const oldRenderAdmin = renderAdmin;
  renderAdmin = async function(){
    if(!isAdmin()) return;
    const grid = document.querySelector('.admin-grid');
    if(grid && !$('#adminMetrics')) grid.insertAdjacentHTML('afterbegin', `<section class="panel" style="grid-column:1/-1"><div class="admin-metrics" id="adminMetrics"><div class="metric"><b id="mUsers">0</b><span>Users</span></div><div class="metric"><b id="mSellers">0</b><span>Seller apps</span></div><div class="metric"><b id="mPosts">0</b><span>Posts</span></div><div class="metric"><b id="mRevenue">₹0</b><span>Tracked revenue</span></div></div><h2>Live Control Feed</h2><div id="adminLiveFeed"></div></section>`);
    if(!sb){ await oldRenderAdmin(); renderAdminFallback(); return; }
    const [users,sellers,posts,payments] = await Promise.all([
      sb.from('profiles').select('id,username,role,account_status,is_banned,is_verified,created_at').order('created_at',{ascending:false}).limit(30).catch(()=>({data:[]})),
      sb.from('seller_applications').select('*').order('created_at',{ascending:false}).limit(30).catch(()=>({data:[]})),
      sb.from('posts').select('id', {count:'exact', head:true}).catch(()=>({count:0})),
      sb.from('payments').select('amount_inr').catch(()=>({data:[]}))
    ]);
    const userRows = users.data || []; const sellerRows = sellers.data || [];
    $('#mUsers') && ($('#mUsers').textContent = userRows.length);
    $('#mSellers') && ($('#mSellers').textContent = sellerRows.filter(s=>s.status==='pending').length);
    $('#mPosts') && ($('#mPosts').textContent = posts.count || 0);
    const rev = (payments.data || []).reduce((a,x)=>a+Number(x.amount_inr||0),0); $('#mRevenue') && ($('#mRevenue').textContent = money(rev));
    $('#adminUsers').innerHTML = userRows.map(u => `<div class="user-row"><b>${escapeHtml(u.username || u.id.slice(0,8))}</b><small>${u.role || 'user'} · ${u.account_status || 'approved'} · ${u.is_banned?'banned':'active'} · ${u.is_verified?'verified':'unverified'}</small><button class="mini" onclick="adminUpdateUser('${u.id}','approved')">Approve</button><button class="mini" onclick="adminBan('${u.id}',${!u.is_banned})">${u.is_banned?'Unban':'Ban'}</button><button class="mini" onclick="adminVerify('${u.id}')">Verify</button></div>`).join('') || 'No users yet';
    $('#adminSellers').innerHTML = sellerRows.map(s => `<div class="user-row"><b>${escapeHtml(s.user_id?.slice(0,8) || 'seller')}</b><small>${s.status || 'pending'} · ${new Date(s.created_at || Date.now()).toLocaleString()}</small><button class="mini" onclick="adminSeller('${s.id}','approved')">Approve</button><button class="mini danger" onclick="adminSeller('${s.id}','rejected')">Reject</button></div>`).join('') || 'No seller applications';
    const feed = $('#adminLiveFeed'); if(feed){
      const rows = [...liveEvents, ...liveFallback].slice(0,8);
      feed.innerHTML = rows.map(x=>`<div class="admin-live-row"><div><b>${escapeHtml(x.user || 'Player')}</b><small>${escapeHtml(x.text || x.content || 'activity')}</small></div><span class="chip">${escapeHtml(x.kind || x.type || 'live')}</span></div>`).join('');
    }
  };
  function renderAdminFallback(){ const f=$('#adminLiveFeed'); if(f) f.innerHTML=liveFallback.map(x=>`<div class="admin-live-row"><div><b>${x.user}</b><small>${x.text}</small></div><span class="chip">demo</span></div>`).join(''); }

  const oldSubscribe = subscribeRealtime;
  subscribeRealtime = function(){
    oldSubscribe(); if(!sb) return;
    sb.channel('stackops-growth-live')
      .on('postgres_changes', {event:'INSERT', schema:'public', table:'profiles'}, p => { addLiveEvent('Joined StackOps', p.new.username || 'NewPlayer', 'join'); refreshTrueCounters(); })
      .on('postgres_changes', {event:'INSERT', schema:'public', table:'posts'}, p => { addLiveEvent('Published a community post', 'Community', 'post'); refreshTrueCounters(); renderPosts(); })
      .on('postgres_changes', {event:'INSERT', schema:'public', table:'seller_applications'}, p => { addLiveEvent('Seller application received', p.new.user_id?.slice(0,8) || 'Seller', 'seller'); refreshTrueCounters(); renderAdmin(); })
      .on('postgres_changes', {event:'INSERT', schema:'public', table:'live_activity'}, p => { liveEvents.unshift({user:p.new.username, text:p.new.content, kind:p.new.type, created_at:p.new.created_at}); liveEvents=liveEvents.slice(0,18); renderLiveCenter(); renderAdmin(); })
      .subscribe();
  };

  const oldRenderAll2 = renderAll;
  renderAll = function(){ oldRenderAll2(); renderLiveCenter(); renderDiscordServers(); renderVoiceRooms(); refreshTrueCounters(); };
  document.addEventListener('DOMContentLoaded', () => { setTimeout(()=>{ renderLiveCenter(); renderDiscordServers(); renderChallengeTracker(); renderVoicePage(); refreshTrueCounters(); setInterval(refreshTrueCounters, 12000); }, 900); });
})();
