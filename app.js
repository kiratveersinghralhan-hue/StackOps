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

  try {
    const { data: authData, error: authErr } = await sb.auth.getUser();
    const user = authData?.user || session?.user;
    if (authErr || !user) throw new Error(authErr?.message || 'Login first');

    const { data: profile } = await sb
      .from('profiles')
      .select('username,display_name,seller_status,is_seller')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.is_seller || profile?.seller_status === 'approved') {
      localStorage.stackopsSellerApproved = '1';
      toast('Seller account already active');
      refreshSellerButton();
      return;
    }

    const { data: existing, error: existingErr } = await sb
      .from('seller_applications')
      .select('id,status')
      .eq('user_id', user.id)
      .neq('status', 'rejected')
      .maybeSingle();

    if (!existingErr && existing?.id) {
      localStorage.stackopsSellerApplied = '1';
      await sb.from('profiles').update({ seller_status: existing.status || 'pending' }).eq('id', user.id);
      toast(existing.status === 'approved' ? 'Seller already approved' : 'Application already pending');
      refreshSellerButton();
      renderAdmin();
      return;
    }

    const applicantName = profile?.display_name || profile?.username || user.email || 'StackOps Player';

    const { error: insertError } = await sb.from('seller_applications').insert([{
      user_id: user.id,
      applicant_email: user.email || '',
      applicant_name: applicantName,
      note: 'Seller application from StackOps marketplace',
      status: 'pending'
    }]);

    if (insertError) throw insertError;

    await sb.from('profiles').update({ seller_status: 'pending' }).eq('id', user.id);
    localStorage.stackopsSellerApplied = '1';
    toast('Seller application submitted for admin approval');
    addLiveEvent('Submitted seller application', applicantName, 'seller');
    refreshSellerButton();
    renderAdmin();
  } catch (err) {
    console.error('Apply seller failed:', err);
    toast('Could not submit seller application: ' + (err?.message || err));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = oldText; }
    refreshSellerButton();
  }
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
    console.warn('Using profile fallback after profile fetch/upsert issue.');
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
    await sb.from('profiles').upsert(profile, { onConflict: 'id' }).then(undefined, ()=>{});
    data = profile;
  }
  me = { ...defaultProfileFor(email), ...data };
  if (!me.title || !me.badge || !me.selected_banner_key) {
    const patch = defaultProfileFor(email);
    await sb.from('profiles').update({ title: me.title || patch.title, badge: me.badge || patch.badge, selected_banner_key: me.selected_banner_key || patch.selected_banner_key, xp: me.xp ?? patch.xp }).eq('id', session.user.id).then(undefined, ()=>{});
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
  if (sb) await sb.from('teams').delete().eq('id', id).then(undefined, ()=>{});
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

  const useCheckout = cfg.RAZORPAY_CHECKOUT_ENABLED === true;
  const paymentLink = cfg.RAZORPAY_PAYMENT_LINK || 'https://razorpay.me/';
  const keyMissing = !window.Razorpay || !cfg.RAZORPAY_KEY_ID || cfg.RAZORPAY_KEY_ID.includes('YOUR_');
  if (!useCheckout || keyMissing) {
    toast(useCheckout && keyMissing ? 'Razorpay key missing. Opening secure payment link.' : 'Opening secure Razorpay payment link.');
    window.open(paymentLink, '_blank');
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
      if (sb && localPaymentId) await sb.from('payments').update({ status:'cancelled' }).eq('id', localPaymentId).then(undefined, ()=>{});
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
        await safeLoadMe().then(undefined, ()=>{});
        await awardXP(80, 'Verified payment reward').then(undefined, ()=>{});
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
  if (sb) await sb.from('profiles').update(patch).eq('id', session.user.id).then(undefined, ()=>{});
  me = { ...me, ...patch }; renderRewards(); updateProfileUI(); toast(`${name} equipped`);
};
window.equipBanner = async (key) => {
  if (needLogin()) return;
  const item = demo.banners.find(x => x.key === key);
  if (!item || !isUnlocked(item)) return toast(item?.adminOnly ? 'Founder banner is admin only' : 'Banner locked — earn XP first');
  localStorage.stackopsBanner = key;
  if (sb) await sb.from('profiles').update({ selected_banner_key:key }).eq('id', session.user.id).then(undefined, ()=>{});
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
  if (sb && session) await sb.from('profiles').update(patch).eq('id', session.user.id).then(undefined, ()=>{});
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
  if (sb) await sb.from('profiles').update({ xp: next }).eq('id', session.user.id).then(undefined, ()=>{});
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
    const { data } = await sb.from('messages').select('*').eq('channel', currentChannel).order('created_at', { ascending:true }).limit(80).then(undefined, ()=>({data:null}));
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
  if (sb) await sb.from('messages').insert({ sender_id:session.user.id, sender_name:me?.username || me?.display_name || 'Player', channel:currentChannel, content }).then(undefined, ()=>{});
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
  const users = (await sb.from('profiles').select('id,username,role,account_status,is_banned,is_verified').limit(30).then(undefined, ()=>({data:[]}))).data || [];
  $('#adminUsers').innerHTML = users.map(u => `<div class="user-row"><b>${u.username || u.id.slice(0,8)}</b><small>${u.role} • ${u.account_status || 'approved'} • ${u.is_banned?'banned':'active'}</small><button class="mini" onclick="adminUpdateUser('${u.id}','approved')">Approve</button><button class="mini" onclick="adminBan('${u.id}',${!u.is_banned})">${u.is_banned?'Unban':'Ban'}</button><button class="mini" onclick="adminVerify('${u.id}')">Verify</button></div>`).join('') || 'No users yet';
  const sellers = (await sb.from('seller_applications').select('*').limit(30).then(undefined, ()=>({data:[]}))).data || [];
  $('#adminSellers').innerHTML = sellers.map(s => `<div class="user-row"><b>${s.user_id?.slice(0,8) || 'seller'}</b><small>${s.status}</small><button class="mini" onclick="adminSeller('${s.id}','approved')">Approve</button><button class="mini" onclick="adminSeller('${s.id}','rejected')">Reject</button></div>`).join('') || 'No seller applications';
}
window.adminUpdateUser = async (id,status)=>{ await sb.from('profiles').update({ account_status:status }).eq('id', id); toast('User updated'); renderAdmin(); };
window.adminBan = async (id,banned)=>{ await sb.from('profiles').update({ is_banned:banned, account_status:banned?'banned':'approved' }).eq('id', id); toast('Ban status updated'); renderAdmin(); };
window.adminVerify = async (id)=>{ await sb.from('profiles').update({ is_verified:true }).eq('id', id); toast('User verified'); renderAdmin(); };
window.adminSeller = async (id,status)=>{
  if (!sb) return toast('Supabase not connected');
  const { data: app } = await sb.from('seller_applications').select('user_id').eq('id', id).maybeSingle().then(undefined, ()=>({data:null}));
  await sb.from('seller_applications').update({ status }).eq('id', id).then(undefined, ()=>{});
  if (app?.user_id && status === 'approved') {
    await sb.from('profiles').update({ is_seller:true, seller_status:'approved', is_verified:true }).eq('id', app.user_id).then(undefined, ()=>{});
  }
  if (app?.user_id && status === 'rejected') {
    await sb.from('profiles').update({ is_seller:false, seller_status:'rejected' }).eq('id', app.user_id).then(undefined, ()=>{});
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
  if(sb) await sb.from('profiles').update({xp:next}).eq('id', session.user.id).then(undefined, ()=>{});
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
  if(sb) await sb.from('daily_checkins').insert({user_id:session.user.id, checkin_date:today, xp_awarded:80 + (streak*10)}).then(undefined, ()=>{});
  if(sb) await sb.from('profiles').update({daily_streak:streak,last_daily_claim:today}).eq('id',session.user.id).then(undefined, ()=>{});
  me={...me,daily_streak:streak,last_daily_claim:today};
  await awardXP(80 + (streak*10), `Daily streak day ${streak}`);
}
function copyInvite(){
  if(needLogin()) return;
  const val=$('#inviteLink')?.value || '';
  navigator.clipboard?.writeText(val).then(()=>toast('Invite link copied')).then(undefined, ()=>toast(val));
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
  if(Object.keys(patch).length && sb) await sb.from('profiles').update(patch).eq('id',session.user.id).then(undefined, ()=>{});
  me={...me,...patch};
  // Referral capture: simple safe insert; duplicate prevented by SQL unique index.
  const ref=localStorage.stackopsRef;
  if(ref && sb && ref !== patch.referral_code){
    await sb.from('referrals').insert({referral_code:ref, invited_user_id:session.user.id}).then(undefined, ()=>{});
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
    if(sb) sb.from('live_activity').insert({ user_id: session?.user?.id || null, username: ev.user, type:kind, content:text }).then(undefined, ()=>{});
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
        sb.from('profiles').select('id', { count:'exact', head:true }).then(undefined, ()=>({count:null})),
        sb.from('teams').select('id', { count:'exact', head:true }).then(undefined, ()=>({count:null})),
        sb.from('posts').select('id', { count:'exact', head:true }).then(undefined, ()=>({count:null})),
        sb.from('seller_applications').select('id', { count:'exact', head:true }).then(undefined, ()=>({count:null}))
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
    if(sb && !String(id).startsWith('demo-')) await sb.from('posts').delete().eq('id', id).then(undefined, ()=>{});
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
    if(sb) await sb.from('chat_servers').insert({id, owner_id:session.user.id, name, visibility, invite_code:id}).then(undefined, ()=>{});
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
      sb.from('profiles').select('id,username,role,account_status,is_banned,is_verified,created_at').order('created_at',{ascending:false}).limit(30).then(undefined, ()=>({data:[]})),
      sb.from('seller_applications').select('*').order('created_at',{ascending:false}).limit(30).then(undefined, ()=>({data:[]})),
      sb.from('posts').select('id', {count:'exact', head:true}).then(undefined, ()=>({count:0})),
      sb.from('payments').select('amount_inr').then(undefined, ()=>({data:[]}))
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

/* === StackOps Seller Approval Desk Patch v2 === */
let sellerDeskFilter = 'pending';

function sellerStatusBadge(status='pending') {
  const s = String(status || 'pending').toLowerCase();
  return `<span class="chip seller-status ${s}">${escapeHtml(s)}</span>`;
}

async function getSellerApplicationsSafe() {
  if (!sb || !session) return { apps: [], profiles: {}, error: 'Supabase not connected' };
  const q = sb.from('seller_applications')
    .select('id,user_id,status,note,applicant_email,applicant_name,created_at,reviewed_at')
    .order('created_at', { ascending:false })
    .limit(80);
  const { data, error } = await q;
  if (error) return { apps: [], profiles: {}, error: error.message };
  const apps = data || [];
  const ids = [...new Set(apps.map(a=>a.user_id).filter(Boolean))];
  let profiles = {};
  if (ids.length) {
    const { data: profs } = await sb.from('profiles')
      .select('id,username,display_name,role,is_seller,seller_status,is_verified,is_banned,created_at')
      .in('id', ids)
      .then(undefined, ()=>({data:[]}));
    (profs || []).forEach(p => profiles[p.id] = p);
  }
  return { apps, profiles, error:null };
}

function sellerReviewCard(app, profile={}) {
  const status = String(app.status || 'pending').toLowerCase();
  const name = profile.display_name || profile.username || app.applicant_name || app.applicant_email || (app.user_id || 'seller').slice(0,8);
  const avatar = initials(name);
  const created = app.created_at ? new Date(app.created_at).toLocaleString() : 'just now';
  const sellerFlag = profile.is_seller ? 'Seller enabled' : 'Not seller yet';
  const ban = profile.is_banned ? 'Banned' : 'Active';
  return `<article class="seller-review-card ${status}">
    <div class="seller-review-top">
      <div class="seller-person"><div class="avatar">${escapeHtml(avatar)}</div><div><h3>${escapeHtml(name)}</h3><small>${escapeHtml(app.applicant_email || profile.username || app.user_id || 'No email saved')}</small></div></div>
      ${sellerStatusBadge(status)}
    </div>
    <div class="seller-meta">
      <span><b>User:</b> ${escapeHtml((app.user_id || '').slice(0,12))}</span>
      <span><b>Applied:</b> ${escapeHtml(created)}</span>
      <span><b>Profile:</b> ${escapeHtml(sellerFlag)} · ${escapeHtml(ban)}</span>
      <span><b>Verified:</b> ${profile.is_verified ? 'Yes' : 'No'}</span>
    </div>
    <p class="muted">${escapeHtml(app.note || 'Wants to sell coaching/services on StackOps.')}</p>
    <div class="seller-actions">
      <button class="btn success" onclick="approveSellerApplication('${app.id}')">Approve Seller</button>
      <button class="btn danger" onclick="rejectSellerApplication('${app.id}')">Reject</button>
      <button class="btn dark" onclick="copySellerUserId('${app.user_id || ''}')">Copy User ID</button>
    </div>
  </article>`;
}

async function renderSellerReview() {
  if (!isAdmin()) return toast('Admin only');
  const list = $('#sellerReviewList');
  if (!list) return;
  list.innerHTML = '<div class="empty-state">Loading seller applications...</div>';
  const { apps, profiles, error } = await getSellerApplicationsSafe();
  if (error) {
    list.innerHTML = `<div class="empty-state"><b>Cannot load applications</b><br>${escapeHtml(error)}<br><small>Run seller-approval-desk-safe.sql once, then refresh.</small></div>`;
    $('#sellerDeskStatus') && ($('#sellerDeskStatus').textContent = 'Policy check');
    return;
  }
  const pending = apps.filter(a => (a.status || 'pending') === 'pending').length;
  const approved = apps.filter(a => a.status === 'approved').length;
  const rejected = apps.filter(a => a.status === 'rejected').length;
  $('#sellerPendingCount') && ($('#sellerPendingCount').textContent = pending);
  $('#sellerApprovedCount') && ($('#sellerApprovedCount').textContent = approved);
  $('#sellerRejectedCount') && ($('#sellerRejectedCount').textContent = rejected);
  $('#sellerDeskStatus') && ($('#sellerDeskStatus').textContent = `${apps.length} total`);
  let rows = apps;
  if (sellerDeskFilter !== 'all') rows = rows.filter(a => String(a.status || 'pending') === sellerDeskFilter);
  list.innerHTML = rows.map(a => sellerReviewCard(a, profiles[a.user_id] || {})).join('') || '<div class="empty-state">No applications in this filter.</div>';

  const adminSellers = $('#adminSellers');
  if (adminSellers) {
    adminSellers.innerHTML = apps.slice(0,5).map(a => sellerReviewCard(a, profiles[a.user_id] || {})).join('') || 'No seller applications';
  }
  const mSellers = $('#mSellers'); if (mSellers) mSellers.textContent = pending;
}

window.approveSellerApplication = async function(id) {
  if (!sb || !isAdmin()) return toast('Admin only');
  const { data: app, error: appErr } = await sb.from('seller_applications').select('user_id').eq('id', id).maybeSingle();
  if (appErr || !app) return toast(appErr?.message || 'Application not found');
  const now = new Date().toISOString();
  const { error: profErr } = await sb.from('profiles').update({
    is_seller:true,
    seller_status:'approved',
    is_verified:true,
    account_status:'approved'
  }).eq('id', app.user_id);
  if (profErr) return toast('Profile update failed: ' + profErr.message);
  const { error: appUpdateErr } = await sb.from('seller_applications').update({status:'approved', reviewed_at:now}).eq('id', id);
  if (appUpdateErr) return toast('Application update failed: ' + appUpdateErr.message);
  await sb.from('notifications').insert({user_id:app.user_id, type:'seller_approved', content:'Your seller account is approved. You can now offer services on StackOps.'}).then(undefined, ()=>{});
  addLiveEvent('Seller approved', app.user_id.slice(0,8), 'admin');
  toast('Seller approved');
  renderSellerReview();
};

window.rejectSellerApplication = async function(id) {
  if (!sb || !isAdmin()) return toast('Admin only');
  const { data: app } = await sb.from('seller_applications').select('user_id').eq('id', id).maybeSingle().then(undefined, ()=>({data:null}));
  await sb.from('seller_applications').update({status:'rejected', reviewed_at:new Date().toISOString()}).eq('id', id);
  if (app?.user_id) {
    await sb.from('profiles').update({is_seller:false, seller_status:'rejected'}).eq('id', app.user_id).then(undefined, ()=>{});
    await sb.from('notifications').insert({user_id:app.user_id, type:'seller_rejected', content:'Your seller application was not approved yet. Improve profile details and apply again.'}).then(undefined, ()=>{});
  }
  toast('Seller rejected');
  renderSellerReview();
};

window.copySellerUserId = function(id){ navigator.clipboard?.writeText(id); toast('User ID copied'); };

// Patch seller application to save enough info for admin cards and avoid Razorpay for seller approval.
applySeller = async function(){
  if (needLogin()) return;
  if (me?.is_seller || me?.seller_status === 'approved') { toast('Seller account already active'); switchView('market'); return; }
  const btn = $('#applySellerBtn'); const old = btn?.textContent || 'Apply to Sell';
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
  let ok = false; let msg = '';
  if (sb && session) {
    const row = {
      user_id: session.user.id,
      status: 'pending',
      note: 'Seller application submitted from StackOps marketplace',
      applicant_email: session.user.email || '',
      applicant_name: me?.display_name || me?.username || (session.user.email || '').split('@')[0]
    };
    let res = await sb.from('seller_applications').insert(row);
    if (res.error && String(res.error.message).includes('applicant_')) {
      res = await sb.from('seller_applications').insert({user_id:row.user_id,status:'pending',note:row.note});
    }
    ok = !res.error; msg = res.error?.message || '';
  }
  if (ok) {
    localStorage.stackopsSellerApplied = '1';
    toast('Application submitted. Admin will review it.');
    addLiveEvent('Submitted seller application', me?.username || 'Player', 'seller');
  } else {
    toast('Could not submit seller application. ' + (msg || 'Check SQL/policies.'));
  }
  if (btn) { btn.disabled = false; btn.textContent = old; }
  refreshSellerButton();
};

// Upgrade navigation hooks for the new page and filter buttons.
const __stackopsOldSwitchView = switchView;
switchView = function(id){
  __stackopsOldSwitchView(id);
  if (id === 'sellerReview') renderSellerReview();
};

document.addEventListener('click', (e)=>{
  const filter = e.target.closest('[data-seller-filter]');
  if (filter) {
    sellerDeskFilter = filter.dataset.sellerFilter;
    document.querySelectorAll('[data-seller-filter]').forEach(b=>b.classList.toggle('active', b === filter));
    renderSellerReview();
  }
  if (e.target.closest('#refreshSellerDesk')) renderSellerReview();
});

// Make admin dashboard link users to the dedicated seller desk.
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(()=>{
    const adminPanel = document.querySelector('#admin .page-head');
    if (adminPanel && !document.querySelector('#openSellerDeskBtn')) {
      adminPanel.insertAdjacentHTML('beforeend','<button id="openSellerDeskBtn" class="btn primary nav" data-view="sellerReview">Open Seller Approval Desk</button>');
    }
  }, 800);
});


/* ==========================================================
   STACKOPS FINAL SELLER DESK + LIVE AUTOMATION PATCH
   - fixes seller application schema mismatch (note column)
   - dedicated approval desk with approve/reject
   - live counters + animated values
   - realtime refresh when seller apps/posts/profiles change
   ========================================================== */
(function(){
  const safe = (v='') => (typeof escapeHtml === 'function' ? escapeHtml(v) : String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])));
  let sellerFilter = 'pending';
  let cachedApps = [];
  let cachedProfiles = {};

  function fmtTime(x){ try { return new Date(x || Date.now()).toLocaleString(); } catch { return 'Just now'; } }
  function setText(id, val){ const el = document.querySelector(id); if(el){ el.textContent = val; el.classList.remove('counter-pulse'); void el.offsetWidth; el.classList.add('counter-pulse'); } }

  window.stackopsRefreshLive = async function(){
    if(!sb) return;
    try{
      const [u,a,p,o,pay] = await Promise.all([
        sb.from('profiles').select('id', {count:'exact', head:true}),
        sb.from('seller_applications').select('id,status', {count:'exact'}),
        sb.from('posts').select('id', {count:'exact', head:true}),
        sb.from('orders').select('amount_inr,status').limit(500).then(undefined, ()=>({data:[]})),
        sb.from('payments').select('amount_inr,status').limit(500).then(undefined, ()=>({data:[]}))
      ]);
      const apps = a.data || [];
      const pending = apps.filter(x => (x.status || 'pending') === 'pending').length;
      const approved = apps.filter(x => x.status === 'approved').length;
      const rejected = apps.filter(x => x.status === 'rejected').length;
      setText('#sellerPendingCount', pending);
      setText('#sellerApprovedCount', approved);
      setText('#sellerRejectedCount', rejected);
      setText('#mUsers', u.count ?? 0);
      setText('#mSellers', pending);
      setText('#mPosts', p.count ?? 0);
      const orderRev = (o.data || []).reduce((sum,x)=>sum + Number(x.amount_inr || 0), 0);
      const payRev = (pay.data || []).reduce((sum,x)=>sum + Number(x.amount_inr || 0), 0);
      setText('#mRevenue', money(Math.max(orderRev, payRev, 0)));
      const hot = document.querySelectorAll('.hot-strip span');
      if(hot[1]) hot[1].textContent = `${Math.max(31, Number(u.count || 0))} squads`;
      if(hot[2]) hot[2].textContent = `${Math.max(8, approved)} coaches`;
    }catch(err){ console.warn('live counters', err.message); }
  };

  async function fetchSellerApps(){
    if(!sb) return {apps:[], profiles:{}, error:'Supabase not connected'};
    const { data: apps, error } = await sb.from('seller_applications').select('*').order('created_at', {ascending:false});
    if(error) return {apps:[], profiles:{}, error:error.message};
    const ids = [...new Set((apps || []).map(x => x.user_id).filter(Boolean))];
    let profiles = {};
    if(ids.length){
      const pr = await sb.from('profiles').select('id,username,display_name,riot_id,region,main_game,is_verified,is_seller,seller_status,created_at').in('id', ids).then(undefined, ()=>({data:[]}));
      (pr.data || []).forEach(p => profiles[p.id] = p);
    }
    cachedApps = apps || [];
    cachedProfiles = profiles;
    return {apps:cachedApps, profiles:cachedProfiles, error:null};
  }

  function appCard(app, profile={}){
    const status = app.status || 'pending';
    const name = profile.display_name || profile.username || app.applicant_name || app.applicant_email || (app.user_id||'player').slice(0,8);
    const email = app.applicant_email || '';
    const note = app.note || app.reason || 'Wants to sell coaching/services on StackOps.';
    const badge = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending';
    return `<article class="seller-approval-card ${badge}">
      <div class="seller-topline">
        <div class="seller-avatar">${safe(initials(name))}</div>
        <div><h3>${safe(name)}</h3><p>${safe(email || app.user_id || 'No email')}</p></div>
        <span class="status-pill ${badge}">${safe(status)}</span>
      </div>
      <div class="seller-meta-grid">
        <span><b>Game</b>${safe(profile.main_game || 'Valorant / Riot')}</span>
        <span><b>Region</b>${safe(profile.region || 'Not set')}</span>
        <span><b>Applied</b>${safe(fmtTime(app.created_at))}</span>
        <span><b>User ID</b>${safe((app.user_id || '').slice(0,8))}</span>
      </div>
      <p class="seller-note">${safe(note)}</p>
      <div class="seller-actions">
        ${status !== 'approved' ? `<button class="btn success" onclick="approveSellerApplication('${app.id}')">Approve</button>` : ''}
        ${status !== 'rejected' ? `<button class="btn danger" onclick="rejectSellerApplication('${app.id}')">Reject</button>` : ''}
        <button class="btn dark" onclick="copySellerUserId('${app.user_id || ''}')">Copy ID</button>
      </div>
    </article>`;
  }

  window.renderSellerReview = async function(){
    if(!isAdmin()) return toast('Founder/admin only');
    const list = document.querySelector('#sellerReviewList');
    if(!list) return;
    list.innerHTML = '<div class="empty-state pulse-soft">Loading seller applications...</div>';
    const {apps, profiles, error} = await fetchSellerApps();
    if(error){
      list.innerHTML = `<div class="empty-state"><b>Seller desk blocked</b><br>${safe(error)}<br><small>Run stackops-clean-live-system.sql once.</small></div>`;
      const st = document.querySelector('#sellerDeskStatus'); if(st) st.textContent = 'SQL needed';
      return;
    }
    const pending = apps.filter(a => (a.status || 'pending') === 'pending').length;
    const approved = apps.filter(a => a.status === 'approved').length;
    const rejected = apps.filter(a => a.status === 'rejected').length;
    setText('#sellerPendingCount', pending); setText('#sellerApprovedCount', approved); setText('#sellerRejectedCount', rejected);
    const st = document.querySelector('#sellerDeskStatus'); if(st) st.textContent = `${apps.length} total`;
    let rows = apps;
    if(sellerFilter !== 'all') rows = rows.filter(a => (a.status || 'pending') === sellerFilter);
    list.innerHTML = rows.map(a => appCard(a, profiles[a.user_id] || {})).join('') || '<div class="empty-state">No applications in this filter.</div>';
    const mini = document.querySelector('#adminSellers');
    if(mini) mini.innerHTML = apps.slice(0,4).map(a => appCard(a, profiles[a.user_id] || {})).join('') || 'No seller applications';
    await window.stackopsRefreshLive?.();
  };

  window.approveSellerApplication = async function(id){
    if(!sb || !isAdmin()) return toast('Admin only');
    const app = cachedApps.find(x => x.id === id) || (await sb.from('seller_applications').select('*').eq('id', id).maybeSingle()).data;
    if(!app) return toast('Application not found');
    const now = new Date().toISOString();
    const p = await sb.from('profiles').update({ is_seller:true, seller_status:'approved', is_verified:true, account_status:'approved' }).eq('id', app.user_id);
    if(p.error) return toast('Profile update failed: ' + p.error.message);
    const s = await sb.from('seller_applications').update({ status:'approved', reviewed_at:now }).eq('id', id);
    if(s.error) return toast('Application update failed: ' + s.error.message);
    await sb.from('activity_events').insert({actor_id:session?.user?.id, username:me?.username||'Founder', event_type:'seller_approved', body:'Approved a seller application'}).then(undefined, ()=>{});
    toast('Seller approved');
    await renderSellerReview(); await renderAdmin?.();
  };

  window.rejectSellerApplication = async function(id){
    if(!sb || !isAdmin()) return toast('Admin only');
    const app = cachedApps.find(x => x.id === id) || (await sb.from('seller_applications').select('*').eq('id', id).maybeSingle()).data;
    if(!app) return toast('Application not found');
    await sb.from('profiles').update({ is_seller:false, seller_status:'rejected' }).eq('id', app.user_id).then(undefined, ()=>{});
    const s = await sb.from('seller_applications').update({ status:'rejected', reviewed_at:new Date().toISOString() }).eq('id', id);
    if(s.error) return toast('Reject failed: ' + s.error.message);
    await sb.from('activity_events').insert({actor_id:session?.user?.id, username:me?.username||'Founder', event_type:'seller_rejected', body:'Rejected a seller application'}).then(undefined, ()=>{});
    toast('Seller rejected');
    await renderSellerReview(); await renderAdmin?.();
  };

  window.copySellerUserId = function(id){ navigator.clipboard?.writeText(id || ''); toast('User ID copied'); };

  window.applySeller = async function(){
    if(needLogin()) return;
    if(me?.is_seller || me?.seller_status === 'approved') { toast('Seller account already active'); return; }
    const btn = document.querySelector('#applySellerBtn'); const old = btn?.textContent || 'Apply to Sell';
    if(btn){ btn.disabled = true; btn.textContent = 'Submitting...'; }
    const row = {
      user_id: session.user.id,
      applicant_email: session.user.email || '',
      applicant_name: me?.display_name || me?.username || (session.user.email || '').split('@')[0],
      note: 'Seller application submitted from StackOps marketplace',
      status: 'pending'
    };
    let res = await sb.from('seller_applications').insert(row);
    if(res.error && String(res.error.message).includes('duplicate')){
      res = await sb.from('seller_applications').update({status:'pending', note:row.note, applicant_email:row.applicant_email, applicant_name:row.applicant_name, created_at:new Date().toISOString()}).eq('user_id', session.user.id);
    }
    if(res.error){ toast('Could not submit seller application: ' + res.error.message); }
    else{
      await sb.from('profiles').update({ seller_status:'pending' }).eq('id', session.user.id).then(undefined, ()=>{});
      await sb.from('activity_events').insert({actor_id:session.user.id, username:row.applicant_name, event_type:'seller_application', body:'Submitted seller application'}).then(undefined, ()=>{});
      localStorage.stackopsSellerApplied = '1'; toast('Seller application submitted');
      await window.stackopsRefreshLive?.();
    }
    if(btn){ btn.disabled = false; btn.textContent = old; }
  };

  const oldAdmin = window.renderAdmin || renderAdmin;
  window.renderAdmin = renderAdmin = async function(){
    if(!isAdmin()) return;
    const adminHead = document.querySelector('#admin .page-head');
    if(adminHead && !document.querySelector('#openSellerDeskBtn')){
      adminHead.insertAdjacentHTML('beforeend', '<button id="openSellerDeskBtn" class="btn primary">Open Seller Approval Desk</button>');
      document.querySelector('#openSellerDeskBtn').onclick = () => switchView('sellerReview');
    }
    try { await oldAdmin(); } catch(e){ console.warn('old admin render', e.message); }
    await window.stackopsRefreshLive?.();
    await renderSellerReview?.();
  };

  const oldSwitch = window.switchView || switchView;
  window.switchView = switchView = function(id){
    oldSwitch(id);
    if(id === 'sellerReview') setTimeout(()=>renderSellerReview(), 60);
    if(id === 'admin') setTimeout(()=>window.stackopsRefreshLive?.(), 80);
  };

  document.addEventListener('click', (e)=>{
    const f = e.target.closest('[data-seller-filter]');
    if(f){ sellerFilter = f.dataset.sellerFilter || 'pending'; document.querySelectorAll('[data-seller-filter]').forEach(b=>b.classList.toggle('active', b===f)); renderSellerReview(); }
    if(e.target.closest('#refreshSellerDesk')) renderSellerReview();
    if(e.target.closest('#openSellerDeskBtn')) switchView('sellerReview');
  });

  function subscribeSellerDesk(){
    if(!sb) return;
    try{
      sb.channel('stackops-admin-live')
        .on('postgres_changes', {event:'*', schema:'public', table:'seller_applications'}, () => { renderSellerReview(); window.stackopsRefreshLive?.(); })
        .on('postgres_changes', {event:'*', schema:'public', table:'profiles'}, () => window.stackopsRefreshLive?.())
        .on('postgres_changes', {event:'*', schema:'public', table:'posts'}, () => window.stackopsRefreshLive?.())
        .subscribe();
    }catch(e){ console.warn('seller realtime', e.message); }
  }

  setTimeout(()=>{ subscribeSellerDesk(); window.stackopsRefreshLive?.(); if(isAdmin()) renderSellerReview(); }, 1500);
  setInterval(()=>window.stackopsRefreshLive?.(), 10000);
})();


/* ==========================================================
   FINAL SELLER + PROFILE FIX OVERRIDES
   - Matches clean seller_applications schema
   - Stops false profile SQL warning
   - Approval Desk works with applicant_email/applicant_name/note
   ========================================================== */
(function(){
  const safeText = (v='') => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmtDate = (x) => { try { return new Date(x || Date.now()).toLocaleString(); } catch { return 'Just now'; } };
  let sellerDeskFilterFinal = 'pending';
  let finalSellerApps = [];
  let finalProfiles = {};

  async function ensureProfileRow(){
    if(!sb || !session?.user) return null;
    const email = (session.user.email || '').toLowerCase();
    const fallback = { id: session.user.id, username: email.split('@')[0] || 'player', display_name: email.split('@')[0] || 'Player', ...defaultProfileFor(email) };
    try{
      let {data, error} = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if(error) console.warn('profiles select warning:', error.message);
      if(!data){
        const up = await sb.from('profiles').upsert(fallback, {onConflict:'id'}).select('*').maybeSingle();
        if(up.error) console.warn('profiles upsert warning:', up.error.message);
        data = up.data || fallback;
      }
      me = {...fallback, ...(data || {})};
      fillAccountForm?.();
      updateProfileUI?.();
      return me;
    }catch(err){
      console.warn('ensureProfileRow fallback:', err?.message || err);
      me = fallback;
      updateProfileUI?.();
      return me;
    }
  }

  const oldSafeLoadMe = window.safeLoadMe;
  window.safeLoadMe = async function(){
    await ensureProfileRow();
    try { await window.stackopsRefreshLive?.(); } catch {}
    try { renderAdmin?.(); } catch {}
  };
  try { safeLoadMe = window.safeLoadMe; } catch {}

  window.applySeller = async function(){
    if(needLogin()) return;
    await ensureProfileRow();
    if(me?.is_seller === true || me?.seller_status === 'approved'){
      toast('Seller account already active');
      switchView?.('market');
      return;
    }
    const btn = document.querySelector('#applySellerBtn');
    const old = btn?.textContent || 'Apply to Sell';
    if(btn){ btn.disabled = true; btn.textContent = 'Submitting...'; }
    try{
      if(!sb) throw new Error('Supabase not connected');
      const email = session.user.email || '';
      const name = me?.display_name || me?.username || email.split('@')[0] || 'Seller';
      const note = 'Seller application submitted from StackOps marketplace';
      const fullRow = {
        user_id: session.user.id,
        applicant_email: email,
        applicant_name: name,
        note,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      let res = await sb.from('seller_applications').insert(fullRow);
      if(res.error && /duplicate|already/i.test(res.error.message || '')){
        res = await sb.from('seller_applications').update({
          applicant_email: email,
          applicant_name: name,
          note,
          status: 'pending',
          created_at: new Date().toISOString()
        }).eq('user_id', session.user.id);
      }
      // If old table is missing optional columns, try minimal insert so user isn't blocked.
      if(res.error && /(applicant_email|applicant_name|note|created_at).*schema cache|column .* does not exist/i.test(res.error.message || '')){
        console.warn('Retrying seller application with minimal schema:', res.error.message);
        res = await sb.from('seller_applications').insert({user_id: session.user.id, status: 'pending'});
      }
      if(res.error) throw res.error;
      await sb.from('profiles').update({seller_status:'pending'}).eq('id', session.user.id).then(undefined, ()=>{});
      await sb.from('activity_events').insert({actor_id:session.user.id, username:name, event_type:'seller_application', body:'Submitted seller application'}).then(undefined, ()=>{});
      localStorage.stackopsSellerApplied = '1';
      toast('Seller application submitted. Admin can approve it from Seller Approval Desk.');
      refreshSellerButton?.();
      await window.stackopsRefreshLive?.();
      await window.renderSellerReview?.();
      await renderAdmin?.();
    }catch(err){
      console.error('Apply seller failed:', err);
      toast('Could not submit seller application: ' + (err.message || err));
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = old; }
    }
  };
  try { applySeller = window.applySeller; } catch {}

  async function fetchFinalSellerApps(){
    if(!sb) return {apps:[], profiles:{}, error:'Supabase not connected'};
    const {data:apps, error} = await sb.from('seller_applications').select('*').order('created_at', {ascending:false});
    if(error) return {apps:[], profiles:{}, error:error.message};
    const ids = [...new Set((apps || []).map(a => a.user_id).filter(Boolean))];
    const profiles = {};
    if(ids.length){
      const pr = await sb.from('profiles').select('*').in('id', ids).then(undefined, ()=>({data:[]}));
      (pr.data || []).forEach(x => profiles[x.id] = x);
    }
    finalSellerApps = apps || [];
    finalProfiles = profiles;
    return {apps:finalSellerApps, profiles:finalProfiles, error:null};
  }

  function finalSellerCard(app, profile={}){
    const status = app.status || 'pending';
    const name = profile.display_name || profile.username || app.applicant_name || app.applicant_email || (app.user_id || 'seller').slice(0,8);
    const email = app.applicant_email || profile.email || profile.username || '';
    const note = app.note || 'Seller wants to list services/coaching on StackOps.';
    const initialsText = (typeof initials === 'function') ? initials(name) : (name || 'S').slice(0,2).toUpperCase();
    const statusClass = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending';
    return `<article class="seller-approval-card ${statusClass}">
      <div class="seller-topline">
        <div class="seller-avatar">${safeText(initialsText)}</div>
        <div><h3>${safeText(name)}</h3><p>${safeText(email || app.user_id || 'No email saved')}</p></div>
        <span class="status-pill ${statusClass}">${safeText(status)}</span>
      </div>
      <div class="seller-meta-grid">
        <span><b>Game</b>${safeText(profile.main_game || 'Riot Games')}</span>
        <span><b>Region</b>${safeText(profile.region || 'Not set')}</span>
        <span><b>Applied</b>${safeText(fmtDate(app.created_at))}</span>
        <span><b>User ID</b>${safeText((app.user_id || '').slice(0,8))}</span>
      </div>
      <p class="seller-note">${safeText(note)}</p>
      <div class="seller-actions">
        ${status !== 'approved' ? `<button class="btn success" onclick="approveSellerApplication('${app.id}')">Approve</button>` : ''}
        ${status !== 'rejected' ? `<button class="btn danger" onclick="rejectSellerApplication('${app.id}')">Reject</button>` : ''}
        <button class="btn dark" onclick="copySellerUserId('${app.user_id || ''}')">Copy ID</button>
      </div>
    </article>`;
  }

  window.renderSellerReview = async function(){
    if(!isAdmin()) { toast('Founder/admin only'); return; }
    const list = document.querySelector('#sellerReviewList') || document.querySelector('#adminSellers');
    if(!list) { switchView?.('admin'); return; }
    list.innerHTML = '<div class="empty-state pulse-soft">Loading seller applications...</div>';
    const {apps, profiles, error} = await fetchFinalSellerApps();
    if(error){
      list.innerHTML = `<div class="empty-state"><b>Seller desk blocked</b><br>${safeText(error)}<br><small>Run STACKOPS-FINAL-CLEAN-RESET.sql once.</small></div>`;
      return;
    }
    const pending = apps.filter(a => (a.status || 'pending') === 'pending').length;
    const approved = apps.filter(a => a.status === 'approved').length;
    const rejected = apps.filter(a => a.status === 'rejected').length;
    const set = (sel,val)=>{ const el=document.querySelector(sel); if(el) el.textContent=val; };
    set('#sellerPendingCount', pending); set('#sellerApprovedCount', approved); set('#sellerRejectedCount', rejected); set('#mSellers', pending);
    const statusEl = document.querySelector('#sellerDeskStatus'); if(statusEl) statusEl.textContent = `${apps.length} total`;
    const rows = sellerDeskFilterFinal === 'all' ? apps : apps.filter(a => (a.status || 'pending') === sellerDeskFilterFinal);
    list.innerHTML = rows.map(a => finalSellerCard(a, profiles[a.user_id] || {})).join('') || '<div class="empty-state">No applications in this filter.</div>';
    const mini = document.querySelector('#adminSellers');
    if(mini && mini !== list) mini.innerHTML = apps.slice(0,4).map(a => finalSellerCard(a, profiles[a.user_id] || {})).join('') || 'No seller applications';
  };

  window.setSellerFilter = function(filter){ sellerDeskFilterFinal = filter || 'pending'; window.renderSellerReview(); };

  window.approveSellerApplication = async function(id){
    if(!sb || !isAdmin()) return toast('Admin only');
    const app = finalSellerApps.find(x => x.id === id) || (await sb.from('seller_applications').select('*').eq('id', id).maybeSingle()).data;
    if(!app?.user_id) return toast('Application not found');
    const now = new Date().toISOString();
    const p = await sb.from('profiles').update({is_seller:true, seller_status:'approved', is_verified:true, account_status:'approved'}).eq('id', app.user_id);
    if(p.error) return toast('Profile update failed: ' + p.error.message);
    const s = await sb.from('seller_applications').update({status:'approved', reviewed_at:now}).eq('id', id);
    if(s.error) return toast('Application update failed: ' + s.error.message);
    await sb.from('activity_events').insert({actor_id:session?.user?.id, username:me?.username||'Founder', event_type:'seller_approved', body:'Approved a seller application'}).then(undefined, ()=>{});
    toast('Seller approved');
    await window.renderSellerReview();
    await renderAdmin?.();
  };

  window.rejectSellerApplication = async function(id){
    if(!sb || !isAdmin()) return toast('Admin only');
    const app = finalSellerApps.find(x => x.id === id) || (await sb.from('seller_applications').select('*').eq('id', id).maybeSingle()).data;
    if(!app?.user_id) return toast('Application not found');
    await sb.from('profiles').update({is_seller:false, seller_status:'rejected'}).eq('id', app.user_id).then(undefined, ()=>{});
    const s = await sb.from('seller_applications').update({status:'rejected', reviewed_at:new Date().toISOString()}).eq('id', id);
    if(s.error) return toast('Reject failed: ' + s.error.message);
    toast('Seller rejected');
    await window.renderSellerReview();
    await renderAdmin?.();
  };

  window.copySellerUserId = function(id){ navigator.clipboard?.writeText(id || ''); toast('User ID copied'); };

  const oldSwitch = window.switchView || switchView;
  window.switchView = function(id){
    oldSwitch(id);
    if(id === 'seller-review') setTimeout(() => window.renderSellerReview(), 50);
    if(id === 'admin') setTimeout(() => { window.renderSellerReview(); window.stackopsRefreshLive?.(); }, 50);
  };
  try { switchView = window.switchView; } catch {}

  // Rewire buttons after DOM is ready/after old handlers.
  setTimeout(() => {
    const apply = document.querySelector('#applySellerBtn'); if(apply) apply.onclick = window.applySeller;
    document.querySelectorAll('[data-view="seller-review"], #openSellerDeskBtn').forEach(b => b.onclick = () => window.switchView('seller-review'));
  }, 500);
})();

/* === StackOps FINAL FULL PROJECT FIX: seller apply + approval desk + live counters === */
(function(){
  const $q = (s)=>document.querySelector(s);
  const esc = (v)=>String(v ?? '').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const notify = (m)=>{ try { toast(m); } catch { alert(m); } };

  async function getCurrentUserFinal(){
    try{
      const sess = await sb?.auth?.getSession?.();
      if(sess?.data?.session?.user) { session = sess.data.session; return sess.data.session.user; }
      const gu = await sb?.auth?.getUser?.();
      if(gu?.data?.user) return gu.data.user;
    }catch{}
    return session?.user || null;
  }

  async function ensureProfileForUserFinal(user){
    if(!sb || !user) return null;
    let {data:profile} = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle().then(undefined, ()=>({data:null}));
    if(profile){ me = profile; return profile; }
    const fallback = {
      id: user.id,
      username: (user.email||'player').split('@')[0],
      display_name: (user.email||'player').split('@')[0],
      plan_key: 'free',
      xp: 0,
      is_seller: false,
      seller_status: 'none',
      is_verified: false
    };
    await sb.from('profiles').upsert(fallback, {onConflict:'id'}).then(undefined, ()=>{});
    const refetch = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle().then(undefined, ()=>({data:fallback}));
    me = refetch.data || fallback;
    return me;
  }

  window.applySeller = async function(){
    const btn = $q('#applySellerBtn');
    const old = btn?.textContent || 'Apply to Sell';
    try{
      if(btn){ btn.disabled = true; btn.textContent = 'Submitting...'; }
      if(!sb) throw new Error('Supabase is not connected. Check config.js');
      const user = await getCurrentUserFinal();
      if(!user){ notify('Please login first.'); return; }
      const profile = await ensureProfileForUserFinal(user);
      if(profile?.is_seller === true || profile?.seller_status === 'approved'){
        notify('Seller account already active.');
        try { switchView('market'); } catch {}
        return;
      }
      const email = user.email || '';
      const name = profile?.display_name || profile?.username || email.split('@')[0] || 'Seller';

      // Avoid duplicate pending applications.
      const existing = await sb.from('seller_applications')
        .select('id,status')
        .eq('user_id', user.id)
        .in('status', ['pending','approved'])
        .maybeSingle()
        .then(undefined, ()=>({data:null,error:null}));
      if(existing?.data?.id){
        notify(existing.data.status === 'approved' ? 'Seller account already approved.' : 'Your seller application is already pending.');
        return;
      }

      const row = {
        user_id: user.id,
        applicant_email: email,
        applicant_name: name,
        note: 'Seller application from StackOps marketplace',
        status: 'pending'
      };
      const {error} = await sb.from('seller_applications').insert(row);
      if(error) throw error;
      await sb.from('profiles').update({seller_status:'pending'}).eq('id', user.id).then(undefined, ()=>{});
      await sb.from('activity_events').insert({actor_id:user.id, username:name, event_type:'seller_application', body:'Submitted seller application'}).then(undefined, ()=>{});
      notify('Seller application submitted. Admin can approve it from Seller Approval Desk.');
      try { addLiveEvent('Submitted seller application', name, 'seller'); } catch {}
      try { await window.renderSellerReview?.(); } catch {}
      try { await window.stackopsRefreshLive?.(); } catch {}
      try { await renderAdmin?.(); } catch {}
    }catch(err){
      console.error('Apply to Sell failed:', err);
      notify('Could not submit seller application: ' + (err?.message || err));
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = old; }
    }
  };
  try { applySeller = window.applySeller; } catch {}

  function appCardFinal(app, profile={}){
    const name = profile.display_name || profile.username || app.applicant_name || app.applicant_email || (app.user_id||'seller').slice(0,8);
    const email = app.applicant_email || profile.email || '';
    const status = app.status || 'pending';
    const pending = status === 'pending';
    return `<div class="seller-review-card ${esc(status)}">
      <div class="seller-review-top">
        <div class="seller-person"><div class="avatar">${esc((name||'S')[0])}</div><div><h3>${esc(name)}</h3><small>${esc(email || app.user_id || '')}</small></div></div>
        <span class="seller-status">${esc(status)}</span>
      </div>
      <p>${esc(app.note || 'Seller application from StackOps marketplace')}</p>
      <small>${app.created_at ? new Date(app.created_at).toLocaleString() : ''}</small>
      <div class="seller-actions">
        ${pending ? `<button class="btn primary" onclick="approveSellerFinal('${app.id}')">Approve</button><button class="btn dark" onclick="rejectSellerFinal('${app.id}')">Reject</button>` : `<button class="btn dark" onclick="approveSellerFinal('${app.id}')">Approve again</button>`}
      </div>
    </div>`;
  }

  async function loadProfilesMapFinal(userIds){
    const map = {};
    if(!sb || !userIds.length) return map;
    const {data} = await sb.from('profiles').select('*').in('id', userIds).then(undefined, ()=>({data:[]}));
    (data||[]).forEach(p=>map[p.id]=p);
    return map;
  }

  window.renderSellerReview = async function(){
    const list = $q('#sellerReviewList') || $q('#adminSellers');
    if(list) list.innerHTML = '<div class="empty-state pulse-soft">Loading seller applications...</div>';
    if(!sb){ if(list) list.innerHTML = '<div class="empty-state">Supabase not connected.</div>'; return; }
    const {data:apps,error} = await sb.from('seller_applications').select('*').order('created_at', {ascending:false}).then(undefined, e=>({data:[], error:e}));
    if(error){ if(list) list.innerHTML = `<div class="empty-state">Could not load seller applications: ${esc(error.message)}</div>`; return; }
    const profiles = await loadProfilesMapFinal([...(new Set((apps||[]).map(a=>a.user_id).filter(Boolean)))]);
    const filter = window.sellerDeskFilterFinal || 'pending';
    const rows = filter === 'all' ? (apps||[]) : (apps||[]).filter(a=>(a.status||'pending')===filter);
    if(list) list.innerHTML = rows.map(a=>appCardFinal(a, profiles[a.user_id]||{})).join('') || '<div class="empty-state">No seller applications in this filter.</div>';
    const mini = $q('#adminSellers');
    if(mini && mini !== list) mini.innerHTML = (apps||[]).slice(0,4).map(a=>appCardFinal(a, profiles[a.user_id]||{})).join('') || 'No seller applications';
    const st = $q('#sellerDeskStatus'); if(st) st.textContent = `${(apps||[]).length} total`;
    const sellerCountEls = [...document.querySelectorAll('[data-counter="sellerApps"], #sellerAppCount')];
    sellerCountEls.forEach(el => el.textContent = String((apps||[]).filter(a=>(a.status||'pending')==='pending').length));
  };

  window.approveSellerFinal = async function(id){
    try{
      const {data:app,error:e1} = await sb.from('seller_applications').select('*').eq('id', id).maybeSingle();
      if(e1 || !app) throw e1 || new Error('Application not found');
      const now = new Date().toISOString();
      const {error:e2} = await sb.from('seller_applications').update({status:'approved', reviewed_at:now}).eq('id', id);
      if(e2) throw e2;
      const {error:e3} = await sb.from('profiles').update({is_seller:true, seller_status:'approved', is_verified:true}).eq('id', app.user_id);
      if(e3) throw e3;
      notify('Seller approved.');
      await window.renderSellerReview();
      try { await window.stackopsRefreshLive?.(); } catch {}
    }catch(err){ notify('Could not approve seller: ' + (err?.message || err)); }
  };
  window.adminApproveSeller = window.approveSellerFinal;
  window.adminSeller = (id, status) => status === 'approved' ? window.approveSellerFinal(id) : window.rejectSellerFinal(id);

  window.rejectSellerFinal = async function(id){
    try{
      const {data:app} = await sb.from('seller_applications').select('*').eq('id', id).maybeSingle().then(undefined, ()=>({data:null}));
      const {error} = await sb.from('seller_applications').update({status:'rejected', reviewed_at:new Date().toISOString()}).eq('id', id);
      if(error) throw error;
      if(app?.user_id) await sb.from('profiles').update({seller_status:'rejected'}).eq('id', app.user_id).then(undefined, ()=>{});
      notify('Seller application rejected.');
      await window.renderSellerReview();
    }catch(err){ notify('Could not reject seller: ' + (err?.message || err)); }
  };
  window.adminRejectSeller = window.rejectSellerFinal;

  const oldSwitchFinal = window.switchView || (typeof switchView !== 'undefined' ? switchView : null);
  if(oldSwitchFinal){
    window.switchView = function(id){
      oldSwitchFinal(id);
      if(id === 'sellerReview' || id === 'admin') setTimeout(()=>window.renderSellerReview?.(), 80);
    };
    try { switchView = window.switchView; } catch {}
  }

  document.addEventListener('click', (e)=>{
    if(e.target?.closest?.('#applySellerBtn')){ e.preventDefault(); window.applySeller(); }
    const f = e.target?.closest?.('[data-seller-filter]');
    if(f){ window.sellerDeskFilterFinal = f.dataset.sellerFilter || 'pending'; window.renderSellerReview(); }
    if(e.target?.closest?.('#openSellerDeskBtn')){ try { switchView('sellerReview'); } catch {} }
  }, true);

  document.addEventListener('DOMContentLoaded', ()=>{
    const b = $q('#applySellerBtn'); if(b) b.onclick = window.applySeller;
    setTimeout(()=>{ try { window.renderSellerReview?.(); } catch {} }, 700);
    if(sb?.channel){
      try{
        sb.channel('seller_apps_final_live')
          .on('postgres_changes', {event:'*', schema:'public', table:'seller_applications'}, ()=>window.renderSellerReview?.())
          .subscribe();
      }catch{}
    }
  });
})();

/* === FINAL SELLER DESK POLISH: one row per user, pending default, details + unapprove === */
(function(){
  const esc = (v)=>String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const qs = (s)=>document.querySelector(s);
  const notify = (m)=>{ try{ toast(m); } catch{ alert(m); } };
  let sellerFilter = 'pending';
  let cachedSellerApps = [];
  let cachedProfiles = {};

  async function currentUser(){
    try{
      const s = await sb?.auth?.getSession?.();
      if(s?.data?.session?.user){ session = s.data.session; return s.data.session.user; }
      const u = await sb?.auth?.getUser?.();
      return u?.data?.user || session?.user || null;
    }catch{ return session?.user || null; }
  }

  async function profileFor(user){
    if(!sb || !user) return null;
    const got = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle().then(r=>r).catch(()=>({data:null}));
    if(got.data){ me = got.data; return got.data; }
    const p = { id:user.id, username:(user.email||'player').split('@')[0], display_name:(user.email||'player').split('@')[0], account_status:'approved', seller_status:'none', is_seller:false, is_verified:false, xp:0, plan_key:'free' };
    await sb.from('profiles').upsert(p,{onConflict:'id'}).catch?.(()=>{});
    me = p; return p;
  }

  // Clean Apply to Sell: update existing application if it exists, otherwise insert. No duplicates.
  window.applySeller = async function(){
    const btn = qs('#applySellerBtn');
    const oldText = btn?.textContent || 'Apply to Sell';
    try{
      if(btn){ btn.disabled = true; btn.textContent = 'Submitting...'; }
      if(!sb) throw new Error('Supabase is not connected. Check config.js');
      const user = await currentUser();
      if(!user){ notify('Please login first.'); return; }
      const p = await profileFor(user);
      if(p?.is_seller === true || p?.seller_status === 'approved'){
        notify('Seller account already active.');
        return;
      }
      const fullRow = {
        user_id: user.id,
        applicant_email: user.email || '',
        applicant_name: p?.display_name || p?.username || (user.email||'seller').split('@')[0],
        note: 'Seller application submitted from StackOps marketplace',
        status: 'pending',
        created_at: new Date().toISOString()
      };

      const existing = await sb.from('seller_applications').select('id,status').eq('user_id', user.id).maybeSingle().then(r=>r).catch(()=>({data:null,error:null}));
      let res;
      if(existing?.data?.id){
        res = await sb.from('seller_applications').update({
          applicant_email: fullRow.applicant_email,
          applicant_name: fullRow.applicant_name,
          note: fullRow.note,
          status: 'pending',
          reviewed_at: null
        }).eq('id', existing.data.id);
      } else {
        res = await sb.from('seller_applications').insert(fullRow);
      }
      if(res?.error) throw res.error;
      await sb.from('profiles').update({seller_status:'pending', is_seller:false}).eq('id', user.id).then(()=>{}).catch?.(()=>{});
      try{ await sb.from('activity_events').insert({actor_id:user.id, username:fullRow.applicant_name, event_type:'seller_application', body:'Submitted seller application'}); }catch{}
      notify('Seller application submitted. Founder can review it now.');
      try{ addLiveEvent('Submitted seller application', fullRow.applicant_name, 'seller'); }catch{}
      try{ await window.renderSellerReview?.(); }catch{}
      try{ await window.stackopsRefreshLive?.(); }catch{}
    }catch(e){
      console.error('Apply seller failed', e);
      notify('Could not submit seller application: ' + (e?.message || e));
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = oldText; }
    }
  };
  try{ applySeller = window.applySeller; }catch{}

  function uniqueLatestByUser(apps){
    const map = new Map();
    (apps||[]).forEach(a=>{
      const key = a.user_id || a.id;
      const prev = map.get(key);
      if(!prev || new Date(a.created_at||0) >= new Date(prev.created_at||0)) map.set(key,a);
    });
    return [...map.values()];
  }

  async function loadProfiles(userIds){
    const map = {};
    if(!sb || !userIds.length) return map;
    const r = await sb.from('profiles').select('*').in('id', userIds).then(r=>r).catch(()=>({data:[]}));
    (r.data||[]).forEach(p=>{ map[p.id]=p; });
    return map;
  }

  async function getActivityCounts(uid){
    const counts = {posts:0,chats:0,teams:0};
    if(!sb || !uid) return counts;
    try{ const r = await sb.from('posts').select('id',{count:'exact',head:true}).eq('user_id',uid); counts.posts = r.count ?? 0; }catch{}
    try{ const r = await sb.from('messages').select('id',{count:'exact',head:true}).eq('user_id',uid); counts.chats = r.count ?? 0; }catch{}
    try{ const r = await sb.from('teams').select('id',{count:'exact',head:true}).eq('owner_id',uid); counts.teams = r.count ?? 0; }catch{}
    return counts;
  }

  function applicationCard(app){
    const p = cachedProfiles[app.user_id] || {};
    const name = p.display_name || p.username || app.applicant_name || app.applicant_email || (app.user_id||'seller').slice(0,8);
    const email = app.applicant_email || p.email || '';
    const status = (app.status || 'pending').toLowerCase();
    const isApproved = status === 'approved';
    const isRejected = status === 'rejected';
    const cls = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending';
    return `<div class="seller-review-card ${cls}">
      <div class="seller-review-top">
        <div class="seller-person"><div class="avatar">${esc((name||'S')[0])}</div><div><h3>${esc(name)}</h3><small>${esc(email || app.user_id || '')}</small></div></div>
        <span class="seller-status">${esc(status)}</span>
      </div>
      <p>${esc(app.note || 'Seller application from StackOps marketplace')}</p>
      <small>${app.created_at ? new Date(app.created_at).toLocaleString() : ''}</small>
      <div class="seller-actions">
        <button class="btn dark" onclick="viewSellerDetailsFinal('${app.id}')">Account Details</button>
        ${!isApproved ? `<button class="btn primary" onclick="approveSellerFinal('${app.id}')">Approve</button>` : `<button class="btn dark" onclick="unapproveSellerFinal('${app.id}')">Unapprove</button>`}
        ${!isRejected ? `<button class="btn danger" onclick="rejectSellerFinal('${app.id}')">Reject</button>` : `<button class="btn primary" onclick="reopenSellerFinal('${app.id}')">Reopen</button>`}
      </div>
    </div>`;
  }

  window.renderSellerReview = async function(){
    const list = qs('#sellerReviewList');
    const mini = qs('#adminSellers');
    if(list) list.innerHTML = '<div class="empty-state pulse-soft">Loading seller applications...</div>';
    if(!sb){ if(list) list.innerHTML = '<div class="empty-state">Supabase not connected.</div>'; return; }
    const res = await sb.from('seller_applications').select('*').order('created_at',{ascending:false}).then(r=>r).catch(e=>({data:[],error:e}));
    if(res.error){ if(list) list.innerHTML = `<div class="empty-state">Could not load seller applications: ${esc(res.error.message)}</div>`; return; }
    cachedSellerApps = uniqueLatestByUser(res.data || []);
    cachedProfiles = await loadProfiles([...new Set(cachedSellerApps.map(a=>a.user_id).filter(Boolean))]);
    const pending = cachedSellerApps.filter(a=>(a.status||'pending')==='pending').length;
    const approved = cachedSellerApps.filter(a=>a.status==='approved').length;
    const rejected = cachedSellerApps.filter(a=>a.status==='rejected').length;
    const set = (id,v)=>{ const el=qs(id); if(el) el.textContent=String(v); };
    set('#sellerPendingCount', pending); set('#sellerApprovedCount', approved); set('#sellerRejectedCount', rejected); set('#mSellers', pending);
    const deskStatus = qs('#sellerDeskStatus'); if(deskStatus) deskStatus.textContent = `${cachedSellerApps.length} total`;

    const rows = sellerFilter === 'all' ? cachedSellerApps : cachedSellerApps.filter(a=>(a.status||'pending')===sellerFilter);
    if(list) list.innerHTML = rows.map(applicationCard).join('') || `<div class="empty-state">No ${esc(sellerFilter)} seller applications.</div>`;

    // Admin dashboard preview only shows pending items, so approved ones do not clutter the main control room.
    if(mini){
      const pRows = cachedSellerApps.filter(a=>(a.status||'pending')==='pending');
      mini.innerHTML = pRows.slice(0,5).map(applicationCard).join('') || '<div class="empty-state">No pending seller applications.</div>';
    }
    document.querySelectorAll('[data-seller-filter]').forEach(b=>b.classList.toggle('active',(b.dataset.sellerFilter||'pending')===sellerFilter));
  };

  async function setAppStatus(id, status){
    const app = cachedSellerApps.find(x=>x.id===id) || (await sb.from('seller_applications').select('*').eq('id',id).maybeSingle()).data;
    if(!app) throw new Error('Application not found');
    const now = new Date().toISOString();
    const appUpdate = await sb.from('seller_applications').update({status, reviewed_at: now}).eq('id', id);
    if(appUpdate.error) throw appUpdate.error;
    const profileUpdate = status === 'approved'
      ? {is_seller:true, seller_status:'approved', account_status:'approved'}
      : status === 'rejected'
        ? {is_seller:false, seller_status:'rejected'}
        : {is_seller:false, seller_status:'pending'};
    await sb.from('profiles').update(profileUpdate).eq('id', app.user_id).then(()=>{}).catch?.(()=>{});
    try{ await sb.from('notifications').insert({user_id:app.user_id, type:`seller_${status}`, content:`Your seller application is ${status}.`}); }catch{}
  }

  window.approveSellerFinal = async function(id){ try{ await setAppStatus(id,'approved'); notify('Seller approved.'); await window.renderSellerReview(); }catch(e){ notify('Could not approve seller: '+(e?.message||e)); } };
  window.rejectSellerFinal = async function(id){ try{ await setAppStatus(id,'rejected'); notify('Seller rejected.'); await window.renderSellerReview(); }catch(e){ notify('Could not reject seller: '+(e?.message||e)); } };
  window.unapproveSellerFinal = async function(id){ try{ await setAppStatus(id,'pending'); notify('Seller moved back to pending.'); sellerFilter='pending'; await window.renderSellerReview(); }catch(e){ notify('Could not unapprove seller: '+(e?.message||e)); } };
  window.reopenSellerFinal = async function(id){ return window.unapproveSellerFinal(id); };
  window.adminSeller = (id,status)=> status==='approved' ? window.approveSellerFinal(id) : window.rejectSellerFinal(id);
  window.adminApproveSeller = window.approveSellerFinal;
  window.adminRejectSeller = window.rejectSellerFinal;

  window.viewSellerDetailsFinal = async function(id){
    const app = cachedSellerApps.find(x=>x.id===id) || (await sb.from('seller_applications').select('*').eq('id',id).maybeSingle()).data;
    if(!app) return notify('Application not found');
    const p = cachedProfiles[app.user_id] || (await sb.from('profiles').select('*').eq('id',app.user_id).maybeSingle().then(r=>r.data).catch(()=>({}))) || {};
    const c = await getActivityCounts(app.user_id);
    const html = `<div class="stackops-modal-backdrop" onclick="this.remove()"><div class="stackops-modal" onclick="event.stopPropagation()">
      <button class="modal-close" onclick="this.closest('.stackops-modal-backdrop').remove()">×</button>
      <h2>Seller Account Details</h2>
      <p><b>Name:</b> ${esc(p.display_name||p.username||app.applicant_name||'Unknown')}</p>
      <p><b>Email:</b> ${esc(app.applicant_email||'')}</p>
      <p><b>User ID:</b> <code>${esc(app.user_id||'')}</code></p>
      <p><b>Status:</b> ${esc(app.status||'pending')}</p>
      <p><b>Profile:</b> ${p.is_verified?'verified':'unverified'} · ${p.is_banned?'banned':'active'} · ${p.role||'user'}</p>
      <p><b>Activity:</b> ${c.posts} posts · ${c.chats} chats · ${c.teams} teams</p>
      <p><b>Note:</b> ${esc(app.note||'')}</p>
      <div class="seller-actions"><button class="btn primary" onclick="approveSellerFinal('${app.id}'); this.closest('.stackops-modal-backdrop').remove();">Approve</button><button class="btn dark" onclick="unapproveSellerFinal('${app.id}'); this.closest('.stackops-modal-backdrop').remove();">Unapprove</button><button class="btn danger" onclick="rejectSellerFinal('${app.id}'); this.closest('.stackops-modal-backdrop').remove();">Reject</button></div>
    </div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  };

  document.addEventListener('click', (e)=>{
    const filterBtn = e.target.closest('[data-seller-filter]');
    if(filterBtn){ sellerFilter = filterBtn.dataset.sellerFilter || 'pending'; window.renderSellerReview(); }
    if(e.target.closest('#refreshSellerDesk')) window.renderSellerReview();
    if(e.target.closest('#applySellerBtn')){ e.preventDefault(); window.applySeller(); }
  }, true);

  const oldSwitch = window.switchView || (typeof switchView !== 'undefined' ? switchView : null);
  if(oldSwitch){
    window.switchView = function(id){ oldSwitch(id); if(id==='sellerReview' || id==='admin') setTimeout(()=>window.renderSellerReview(),120); };
    try{ switchView = window.switchView; }catch{}
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    setTimeout(()=>window.renderSellerReview?.(), 900);
    try{ sb?.channel('seller_desk_final_status').on('postgres_changes',{event:'*',schema:'public',table:'seller_applications'},()=>window.renderSellerReview()).subscribe(); }catch{}
  });
})();

/* ==========================================================
   STACKOPS MIDDLEMAN MARKETPLACE + MANUAL UPI PAYMENT SYSTEM
   - Platform receives payment first
   - Admin approves proof
   - Seller payout amount tracked after commission
   ========================================================== */
(function(){
  const safe = (v='') => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const upiId = () => (window.STACKOPS_CONFIG?.MANUAL_UPI_ID || 'yourupi@bank');
  const qrUrl = () => (window.STACKOPS_CONFIG?.MANUAL_UPI_QR_URL || '');
  let selectedManualOrder = null;

  function platformCommission(amount){
    amount = Number(amount || 0);
    if (amount < 500) return 7;
    if (amount < 1000) return 10;
    if (amount < 2000) return 15;
    if (amount < 5000) return 20;
    return 25;
  }

  function middlemanCommission(amount){
    const pct = platformCommission(amount);
    const commission = Math.round(Number(amount || 0) * pct / 100);
    return { pct, commission, sellerGets: Number(amount || 0) - commission };
  }

  function ensureManualPaymentModal(){
    if (document.querySelector('#manualPaymentModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="manualPaymentModal" class="modal">
        <div class="modal-card manual-pay-card">
          <button class="close" type="button" id="closeManualPayment">×</button>
          <span class="eyebrow">Secure Manual Payment</span>
          <h2 id="manualPayTitle">Complete Payment</h2>
          <p class="muted">Pay to StackOps UPI first. Admin verifies your proof manually, then the seller delivers. Approval may take 24–48 hours.</p>
          <div class="upi-box">
            <div><small>Amount</small><b id="manualPayAmount">₹0</b></div>
            <div><small>UPI ID</small><b id="manualUpiId"></b></div>
          </div>
          <div id="manualQrWrap" class="manual-qr hidden"><img id="manualQrImg" alt="UPI QR"></div>
          <button class="btn dark full" id="copyUpiBtn">Copy UPI ID</button>
          <label class="proof-upload">
            <span>Upload payment screenshot/proof <b>(reference number must be clearly visible)</b></span>
            <input id="paymentProofFile" type="file" accept="image/*,.pdf">
          </label>
          <label class="proof-upload">
            <span>Payment reference / UTR number</span>
            <input id="paymentReferenceNumber" type="text" placeholder="Enter UPI reference / UTR number">
          </label>
          <button class="btn primary full" id="submitManualProofBtn">Submit Payment Proof</button>
          <small class="muted">After submission, approval can take <b>24–48 hours</b> because StackOps manually checks proof. Upload clear screenshot with reference number visible.</small>
        </div>
      </div>`);
    document.querySelector('#closeManualPayment')?.addEventListener('click',()=>document.querySelector('#manualPaymentModal')?.classList.remove('active'));
    document.querySelector('#copyUpiBtn')?.addEventListener('click',()=>{ navigator.clipboard?.writeText(upiId()); toast('UPI ID copied'); });
    document.querySelector('#submitManualProofBtn')?.addEventListener('click', submitManualPaymentProof);
  }

  async function isCurrentUserSeller(){
    if (!session) return false;
    if (me?.is_seller || me?.seller_status === 'approved' || isAdmin()) return true;
    if (!sb) return false;
    const { data } = await sb.from('profiles').select('is_seller,seller_status').eq('id', session.user.id).maybeSingle().then(undefined,()=>({data:null}));
    return !!(data?.is_seller || data?.seller_status === 'approved');
  }

  async function createSellerService(){
    if (needLogin()) return;
    if (!(await isCurrentUserSeller())) return toast('Only approved sellers can create services. Apply to sell first.');
    const title = document.querySelector('#serviceTitle')?.value?.trim();
    const game = document.querySelector('#serviceGame')?.value?.trim() || 'Valorant';
    const price = Number(document.querySelector('#servicePrice')?.value || 0);
    const description = document.querySelector('#serviceDesc')?.value?.trim();
    if (!title || !description || price < 1) return toast('Enter service title, description and valid price');
    const row = { seller_id: session.user.id, title, game, description, price_inr: price, status:'active' };
    if (sb) {
      const { error } = await sb.from('seller_services').insert(row);
      if (error) return toast('Could not create service: ' + error.message);
    } else {
      const local = JSON.parse(localStorage.stackopsSellerServices || '[]');
      local.unshift({...row,id:'local-'+Date.now(), seller_name: me?.username || session.user.email});
      localStorage.stackopsSellerServices = JSON.stringify(local);
    }
    ['#serviceTitle','#servicePrice','#serviceDesc'].forEach(id=>{ const el=document.querySelector(id); if(el) el.value=''; });
    toast('Service listed. Buyers can now submit payment proof.');
    await renderServices();
  }

  async function loadSellerServices(){
    if (sb) {
      const { data, error } = await sb.from('seller_services')
        .select('id,seller_id,title,game,description,price_inr,status,created_at')
        .eq('status','active')
        .order('created_at',{ascending:false})
        .limit(50);
      if (!error && data?.length) return data;
    }
    const local = JSON.parse(localStorage.stackopsSellerServices || '[]');
    if (local.length) return local;
    return demo.services.map((s,i)=>({id:'demo-'+i,seller_id:null,title:s.title,game:'Valorant',description:s.description,price_inr:s.price_inr,status:'active', demo:true}));
  }

  async function openManualPayment(service){
    if (needLogin()) return;
    ensureManualPaymentModal();
    selectedManualOrder = service;
    const { pct, commission, sellerGets } = middlemanCommission(service.price_inr);
    document.querySelector('#manualPayTitle').textContent = service.title;
    document.querySelector('#manualPayAmount').textContent = money(service.price_inr);
    document.querySelector('#manualUpiId').textContent = upiId();
    const qr = qrUrl();
    if (qr) { document.querySelector('#manualQrImg').src = qr; document.querySelector('#manualQrWrap').classList.remove('hidden'); }
    else document.querySelector('#manualQrWrap').classList.add('hidden');
    const card = document.querySelector('.manual-pay-card .muted');
    if (card) card.innerHTML = `Pay to UPI <b>${upiId()}</b>. Commission: <b>${pct}% (${money(commission)})</b>. Seller payout after completion: <b>${money(sellerGets)}</b>.`;
    document.querySelector('#manualPaymentModal').classList.add('active');
  }

  async function submitManualPaymentProof(){
    if (!selectedManualOrder || needLogin()) return;
    const file = document.querySelector('#paymentProofFile')?.files?.[0];
    const referenceNumber = document.querySelector('#paymentReferenceNumber')?.value?.trim();
    if (!file) return toast('Upload payment screenshot first');
    if (!referenceNumber || referenceNumber.length < 6) return toast('Enter payment reference / UTR number');
    const { pct, commission, sellerGets } = middlemanCommission(selectedManualOrder.price_inr);
    let proofPath = '';
    if (sb) {
      const safeName = file.name.replace(/[^a-z0-9_.-]/gi,'-');
      proofPath = `${session.user.id}/${Date.now()}-${safeName}`;
      const up = await sb.storage.from('payment-proofs').upload(proofPath, file, { upsert:false });
      if (up.error) return toast('Proof upload failed: ' + up.error.message);
      const row = {
        buyer_id: session.user.id,
        seller_id: selectedManualOrder.seller_id || null,
        service_id: String(selectedManualOrder.id || ''),
        service_title: selectedManualOrder.title,
        amount_inr: Number(selectedManualOrder.price_inr),
        commission_percent: pct,
        commission_inr: commission,
        seller_payout_inr: sellerGets,
        proof_path: proofPath,
        reference_number: referenceNumber,
        status: 'pending'
      };
      const ins = await sb.from('manual_orders').insert(row);
      if (ins.error) return toast('Payment request failed: ' + ins.error.message);
    } else {
      const rows = JSON.parse(localStorage.stackopsManualOrders || '[]');
      rows.unshift({id:'local-'+Date.now(), service_title:selectedManualOrder.title, amount_inr:selectedManualOrder.price_inr, reference_number: referenceNumber, status:'pending', created_at:new Date().toISOString()});
      localStorage.stackopsManualOrders = JSON.stringify(rows);
    }
    document.querySelector('#manualPaymentModal')?.classList.remove('active');
    toast('Payment proof submitted. It will reflect in your account after admin verification within 24–48 hours.');
    selectedManualOrder = null;
    renderManualOrdersAdmin();
  }

  window.openManualPaymentForService = async function(id){
    const services = await loadSellerServices();
    const svc = services.find(s => String(s.id) === String(id));
    if (!svc) return toast('Service not found');
    openManualPayment(svc);
  };

  const oldRenderServices = window.renderServices || renderServices;
  renderServices = async function(){
    renderPlans?.();
    const list = document.querySelector('#serviceList');
    if (!list) return;
    const seller = await isCurrentUserSeller();
    const services = await loadSellerServices();
    const sellerBox = seller ? `<section class="panel seller-create-box"><div class="panel-head"><h2>Create Seller Service</h2><span class="chip">Approved seller</span></div><input id="serviceTitle" placeholder="Service title e.g. Valorant Aim Coaching"><input id="serviceGame" placeholder="Game e.g. Valorant"><input id="servicePrice" type="number" placeholder="Price in ₹"><textarea id="serviceDesc" placeholder="What will buyer get?"></textarea><button class="btn primary full" id="createSellerServiceBtn">Publish Service</button></section>` : `<section class="panel"><h2>Want to sell?</h2><p class="muted">Apply as seller, upload proof when asked, then admin approves your account. Payments come to StackOps first and seller payout is tracked after commission.</p></section>`;
    list.innerHTML = sellerBox + services.map(s => {
      const calc = middlemanCommission(s.price_inr);
      return `<article class="service-card"><span class="tag">Admin approved</span><h3>${safe(s.title)}</h3><p>${safe(s.description)}</p><small>${safe(s.game || 'Riot Games')}</small><h2>${money(s.price_inr)}</h2><small>Platform commission: ${calc.pct}% · Seller payout: ${money(calc.sellerGets)}</small><button class="btn primary full" onclick="openManualPaymentForService('${safe(String(s.id))}')">Book / Pay Proof</button></article>`;
    }).join('');
    document.querySelector('#createSellerServiceBtn')?.addEventListener('click', createSellerService);
    refreshPaymentGMV?.();
    refreshSellerButton?.();
  };

  async function getProofUrl(path){
    if (!path || !sb) return '';
    const { data } = await sb.storage.from('payment-proofs').createSignedUrl(path, 60 * 10).then(undefined,()=>({data:null}));
    return data?.signedUrl || '';
  }

  async function renderManualOrdersAdmin(){
    if (!isAdmin() || !sb) return;
    let host = document.querySelector('#manualOrdersAdmin');
    const admin = document.querySelector('#admin .admin-grid');
    if (!host && admin) {
      admin.insertAdjacentHTML('beforeend', `<section class="panel manual-admin-panel"><div class="panel-head"><h2>Manual Payment Requests</h2><span class="chip">Middleman escrow</span></div><div id="manualOrdersAdmin" class="admin-list"></div></section>`);
      host = document.querySelector('#manualOrdersAdmin');
    }
    if (!host) return;
    host.innerHTML = 'Loading payments...';
    const { data, error } = await sb.from('manual_orders').select('*').order('created_at',{ascending:false}).limit(50);
    if (error) { host.innerHTML = 'Cannot load payments: ' + safe(error.message); return; }
    const rows = data || [];
    host.innerHTML = rows.map(o => `<div class="manual-order-card ${safe(o.status)}"><b>${safe(o.service_title)}</b><small>${money(o.amount_inr)} · ${safe(o.status)} · Ref/UTR: ${safe(o.reference_number || 'not entered')} · Commission ${money(o.commission_inr)} · Seller payout ${money(o.seller_payout_inr)}</small><div class="row-actions"><button class="mini" onclick="viewPaymentProof('${safe(o.proof_path || '')}')">View Proof</button><button class="mini success" onclick="approveManualOrder('${o.id}')">Approve Buyer Access</button><button class="mini danger" onclick="rejectManualOrder('${o.id}')">Reject</button><button class="mini" onclick="markSellerPaid('${o.id}')">Mark Seller Paid</button></div></div>`).join('') || 'No manual payment requests yet';
  }

  window.viewPaymentProof = async function(path){
    const url = await getProofUrl(path);
    if (!url) return toast('Proof not available');
    window.open(url, '_blank');
  };
  window.approveManualOrder = async function(id){
    if (!sb || !isAdmin()) return;
    const { error } = await sb.from('manual_orders').update({status:'approved', approved_at:new Date().toISOString()}).eq('id',id);
    if (error) return toast(error.message);
    toast('Payment approved. Seller can deliver now.'); renderManualOrdersAdmin();
  };
  window.rejectManualOrder = async function(id){
    if (!sb || !isAdmin()) return;
    const { error } = await sb.from('manual_orders').update({status:'rejected'}).eq('id',id);
    if (error) return toast(error.message);
    toast('Payment rejected'); renderManualOrdersAdmin();
  };
  window.markSellerPaid = async function(id){
    if (!sb || !isAdmin()) return;
    const { error } = await sb.from('manual_orders').update({payout_status:'paid', payout_paid_at:new Date().toISOString()}).eq('id',id);
    if (error) return toast(error.message);
    toast('Seller payout marked paid'); renderManualOrdersAdmin();
  };

  const oldRenderAdmin = window.renderAdmin || renderAdmin;
  renderAdmin = async function(){
    await oldRenderAdmin?.();
    await renderManualOrdersAdmin();
  };

  const oldSwitch = window.switchView || switchView;
  switchView = function(id){
    oldSwitch(id);
    if (id === 'market') setTimeout(()=>renderServices(), 100);
    if (id === 'admin') setTimeout(()=>renderManualOrdersAdmin(), 300);
  };

  document.addEventListener('DOMContentLoaded', ()=>{
    ensureManualPaymentModal();
    setTimeout(()=>{ renderServices(); renderManualOrdersAdmin(); }, 1200);
  });
})();

/* ==========================================================
   STACKOPS FINAL PATCH: Manual UPI payments only (no Razorpay)
   ========================================================== */
(function(){
  function stackopsManualCommission(amount){
    const n = Number(amount || 0);
    const rules = (window.STACKOPS_CONFIG && window.STACKOPS_CONFIG.COMMISSION_RULES) || [];
    const rule = rules.find(r => n >= Number(r.min||0) && n <= Number(r.max||999999999)) || { percent: 15 };
    const pct = Number(rule.percent || 15);
    const commission = Math.round(n * pct / 100);
    return { pct, commission, sellerGets: Math.max(0, n - commission) };
  }
  function stackopsMoney(v){
    try { return typeof money === 'function' ? money(v) : `₹${Number(v||0).toLocaleString('en-IN')}`; }
    catch(e){ return `₹${v}`; }
  }
  function stackopsToast(msg){
    try { if (typeof toast === 'function') return toast(msg); } catch(e) {}
    alert(msg);
  }
  function stackopsNeedLogin(){
    try { return typeof needLogin === 'function' ? needLogin() : !session?.user; } catch(e) { return !session?.user; }
  }
  function stackopsEnsureManualModal(){
    if (document.querySelector('#stackopsManualPayModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="stackopsManualPayModal" class="manual-modal hidden">
        <div class="manual-modal-card">
          <button class="manual-modal-close" id="stackopsManualClose" aria-label="Close">×</button>
          <span class="chip">Manual UPI payment</span>
          <h2 id="stackopsPayTitle">Complete Payment</h2>
          <p class="muted">Pay to StackOps first. Your payment will reflect in your account within <b>24–48 hours</b> after admin verification.</p>
          <div class="manual-pay-grid">
            <div class="qr-box"><img id="stackopsPayQr" alt="UPI QR Code"></div>
            <div>
              <p>Amount</p><h2 id="stackopsPayAmount">₹0</h2>
              <p>UPI ID</p><div class="copy-line"><b id="stackopsPayUpi">ralhanx@ptaxis</b><button class="mini" id="stackopsCopyUpi">Copy</button></div>
              <p class="muted">Screenshot must clearly show the UPI reference / UTR number.</p>
            </div>
          </div>
          <label class="field-label">Reference / UTR number</label>
          <input id="stackopsPayRef" type="text" placeholder="Enter UPI reference / UTR number" autocomplete="off">
          <label class="field-label">Upload payment screenshot / proof</label>
          <input id="stackopsPayProof" type="file" accept="image/*,.pdf">
          <button class="btn primary full" id="stackopsSubmitManualPay">Submit Payment Proof</button>
          <p class="muted small">Admin will approve/reject after checking proof. Keep your screenshot until approval.</p>
        </div>
      </div>`);
    document.querySelector('#stackopsManualClose')?.addEventListener('click', ()=>document.querySelector('#stackopsManualPayModal')?.classList.add('hidden'));
    document.querySelector('#stackopsCopyUpi')?.addEventListener('click', async ()=>{
      const upi = (window.STACKOPS_CONFIG && window.STACKOPS_CONFIG.MANUAL_UPI_ID) || 'ralhanx@ptaxis';
      try { await navigator.clipboard.writeText(upi); stackopsToast('UPI ID copied'); } catch(e) { stackopsToast(upi); }
    });
    document.querySelector('#stackopsSubmitManualPay')?.addEventListener('click', stackopsSubmitManualPayment);
  }
  let currentManualItem = null;
  async function stackopsOpenManualPayment(item){
    if (stackopsNeedLogin()) return;
    currentManualItem = item || {};
    stackopsEnsureManualModal();
    const upi = (window.STACKOPS_CONFIG && window.STACKOPS_CONFIG.MANUAL_UPI_ID) || 'ralhanx@ptaxis';
    const qr = (window.STACKOPS_CONFIG && window.STACKOPS_CONFIG.MANUAL_UPI_QR_URL) || 'upi-qr.jpeg';
    document.querySelector('#stackopsPayTitle').textContent = item.name || item.title || 'StackOps Payment';
    document.querySelector('#stackopsPayAmount').textContent = stackopsMoney(item.amount || item.price_inr || 0);
    document.querySelector('#stackopsPayUpi').textContent = upi;
    document.querySelector('#stackopsPayQr').src = qr;
    const ref = document.querySelector('#stackopsPayRef'); if (ref) ref.value = '';
    const file = document.querySelector('#stackopsPayProof'); if (file) file.value = '';
    document.querySelector('#stackopsManualPayModal')?.classList.remove('hidden');
  }
  async function stackopsSubmitManualPayment(){
    if (stackopsNeedLogin()) return;
    const item = currentManualItem || {};
    const amount = Number(item.amount || item.price_inr || 0);
    const reference = document.querySelector('#stackopsPayRef')?.value?.trim();
    const file = document.querySelector('#stackopsPayProof')?.files?.[0];
    if (!amount || amount < 1) return stackopsToast('Invalid payment amount');
    if (!reference || reference.length < 6) return stackopsToast('Enter valid UPI reference / UTR number');
    if (!file) return stackopsToast('Upload payment screenshot / proof first');
    if (!sb || !session?.user) return stackopsToast('Supabase not ready. Login again and retry.');

    const calc = stackopsManualCommission(amount);
    const safeName = (file.name || 'proof.png').replace(/[^a-z0-9_.-]/gi,'-');
    const proofPath = `${session.user.id}/${Date.now()}-${safeName}`;
    const uploaded = await sb.storage.from('payment-proofs').upload(proofPath, file, { upsert:false });
    if (uploaded.error) return stackopsToast('Proof upload failed: ' + uploaded.error.message);

    const row = {
      buyer_id: session.user.id,
      seller_id: item.seller_id || null,
      service_id: String(item.id || item.plan_key || item.key || ''),
      service_title: item.name || item.title || 'StackOps Payment',
      item_type: item.type || 'plan',
      plan_key: item.plan_key || item.key || null,
      amount_inr: amount,
      commission_percent: calc.pct,
      commission_inr: calc.commission,
      seller_payout_inr: calc.sellerGets,
      proof_path: proofPath,
      reference_number: reference,
      status: 'pending',
      payout_status: 'pending'
    };
    const inserted = await sb.from('manual_orders').insert(row);
    if (inserted.error) return stackopsToast('Payment request failed: ' + inserted.error.message);
    document.querySelector('#stackopsManualPayModal')?.classList.add('hidden');
    stackopsToast('Payment proof submitted. It will reflect in your account within 24–48 hours after admin verification.');
    try { if (typeof renderManualOrdersAdmin === 'function') renderManualOrdersAdmin(); } catch(e) {}
  }

  window.buyPlan = async function(planKey){
    const plan = (demo?.plans || []).find(p => p.key === planKey);
    if (!plan) return stackopsToast('Plan not found');
    if (Number(plan.price_inr || 0) <= 0) return stackopsToast('Free plan is already available');
    return stackopsOpenManualPayment({
      id: plan.key, key: plan.key, plan_key: plan.key, type:'plan',
      name: `StackOps ${plan.name} Plan`, amount: Number(plan.price_inr || 0)
    });
  };
  window.buy = async function(name, amount, type='service'){
    return stackopsOpenManualPayment({ name, title:name, amount:Number(amount||0), type });
  };
  try { startRazorpayCheckout = async function({ name, amount, type='service', plan_key=null }){ return stackopsOpenManualPayment({ name, amount, type, plan_key }); }; } catch(e) {}
  document.addEventListener('DOMContentLoaded', stackopsEnsureManualModal);
})();

/* ==========================================================
   STACKOPS NEXT UPGRADE: polished manual UPI payments,
   admin payment queue, seller wallet + payout tracking.
   ========================================================== */
(function(){
  const cfg2 = () => window.STACKOPS_CONFIG || {};
  const upi = () => cfg2().MANUAL_UPI_ID || 'ralhanx@ptaxis';
  const qr = () => cfg2().MANUAL_UPI_QR_URL || 'upi-qr.jpeg';
  const rupee = (v) => { try { return typeof money === 'function' ? money(v) : `₹${Number(v||0).toLocaleString('en-IN')}`; } catch(e){ return `₹${v||0}`; } };
  const say = (m) => { try { if (typeof toast === 'function') return toast(m); } catch(e){} alert(m); };
  const admin = () => { try { return typeof isAdmin === 'function' && isAdmin(); } catch(e){ return false; } };
  const signedProofUrl = async (path) => {
    if (!path || !sb) return '';
    const res = await sb.storage.from('payment-proofs').createSignedUrl(path, 600).then(undefined,()=>({data:null}));
    return res?.data?.signedUrl || '';
  };
  const calcCommission2 = (amount) => {
    const n = Number(amount || 0);
    const rules = cfg2().COMMISSION_RULES || [];
    const rule = rules.find(r => n >= Number(r.min||0) && n <= Number(r.max||99999999)) || { percent: 15 };
    const pct = Number(rule.percent || 15);
    const commission = Math.round(n * pct / 100);
    return { pct, commission, sellerGets: Math.max(0, n - commission) };
  };

  function ensureModal2(){
    if (document.querySelector('#soManualModalV2')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="soManualModalV2" class="manual-modal hidden">
        <div class="manual-modal-card">
          <button class="manual-modal-close" id="soManualCloseV2">×</button>
          <span class="chip">Middleman escrow</span>
          <h2 id="soPayTitleV2">Complete UPI Payment</h2>
          <p class="notice">Pay to StackOps first. Upload a clear screenshot where the UPI Reference / UTR number is visible. Approval can take <b>24–48 hours</b>.</p>
          <div class="manual-pay-grid">
            <div class="qr-box"><img id="soPayQrV2" alt="StackOps UPI QR"></div>
            <div>
              <p>Amount</p><h2 id="soPayAmountV2">₹0</h2>
              <p>UPI ID</p><div class="copy-line"><b id="soPayUpiV2">ralhanx@ptaxis</b><button class="mini" id="soCopyUpiV2">Copy</button></div>
              <small class="muted">Buyer pays you first. You approve order, then pay seller after completion.</small>
            </div>
          </div>
          <label class="field-label">UPI Reference / UTR Number</label>
          <input id="soPayRefV2" type="text" placeholder="Example: 412345678901" autocomplete="off">
          <label class="field-label">Payment screenshot / proof</label>
          <input id="soPayProofV2" type="file" accept="image/*,.pdf">
          <button class="btn primary full" id="soSubmitPayV2">Submit Payment Proof</button>
          <p class="muted small">You will see pending status until admin verifies the proof.</p>
        </div>
      </div>`);
    document.querySelector('#soManualCloseV2')?.addEventListener('click', ()=>document.querySelector('#soManualModalV2')?.classList.add('hidden'));
    document.querySelector('#soCopyUpiV2')?.addEventListener('click', async()=>{ try { await navigator.clipboard.writeText(upi()); say('UPI ID copied'); } catch(e){ say(upi()); } });
    document.querySelector('#soSubmitPayV2')?.addEventListener('click', submitManualPaymentV2);
  }

  let currentItemV2 = null;
  async function openManualPaymentV2(item){
    if (typeof needLogin === 'function' && needLogin()) return;
    if (!session?.user) return say('Login first');
    ensureModal2();
    currentItemV2 = item || {};
    document.querySelector('#soPayTitleV2').textContent = currentItemV2.name || currentItemV2.title || 'StackOps Payment';
    document.querySelector('#soPayAmountV2').textContent = rupee(currentItemV2.amount || currentItemV2.price_inr || 0);
    document.querySelector('#soPayUpiV2').textContent = upi();
    document.querySelector('#soPayQrV2').src = qr();
    document.querySelector('#soPayRefV2').value = '';
    document.querySelector('#soPayProofV2').value = '';
    document.querySelector('#soManualModalV2').classList.remove('hidden');
  }

  async function submitManualPaymentV2(){
    if (!sb || !session?.user) return say('Login again and retry');
    const item = currentItemV2 || {};
    const amount = Number(item.amount || item.price_inr || 0);
    const reference = document.querySelector('#soPayRefV2')?.value?.trim();
    const file = document.querySelector('#soPayProofV2')?.files?.[0];
    if (!amount || amount < 1) return say('Invalid payment amount');
    if (!reference || reference.length < 6) return say('Enter valid UPI Reference / UTR number');
    if (!file) return say('Upload screenshot/proof first');
    const safeName = (file.name || 'proof.png').replace(/[^a-z0-9_.-]/gi, '-');
    const proofPath = `${session.user.id}/${Date.now()}-${safeName}`;
    const up = await sb.storage.from('payment-proofs').upload(proofPath, file, { upsert: false });
    if (up.error) return say('Proof upload failed: ' + up.error.message);
    const c = calcCommission2(amount);
    const row = {
      buyer_id: session.user.id,
      seller_id: item.seller_id || null,
      service_id: String(item.id || item.key || item.plan_key || ''),
      service_title: item.name || item.title || 'StackOps Payment',
      item_type: item.type || (item.plan_key ? 'plan' : 'service'),
      plan_key: item.plan_key || item.key || null,
      amount_inr: amount,
      commission_percent: c.pct,
      commission_inr: c.commission,
      seller_payout_inr: c.sellerGets,
      proof_path: proofPath,
      reference_number: reference,
      status: 'pending',
      payout_status: 'pending'
    };
    const ins = await sb.from('manual_orders').insert(row);
    if (ins.error) return say('Payment request failed: ' + ins.error.message);
    document.querySelector('#soManualModalV2')?.classList.add('hidden');
    say('Payment proof submitted. It will reflect in your account within 24–48 hours after admin verification.');
    try { await renderManualOrdersAdminV2(); await renderSellerWalletV2(); } catch(e){}
  }

  async function renderManualOrdersAdminV2(){
    if (!sb || !admin()) return;
    let host = document.querySelector('#manualOrdersAdmin');
    const adminPanel = document.querySelector('#admin');
    if (!host && adminPanel) {
      adminPanel.insertAdjacentHTML('beforeend', `<section class="panel"><div class="panel-head"><h2>Manual Payment Requests</h2><span class="chip">Middleman escrow</span></div><div id="manualOrdersAdmin" class="admin-list"></div></section>`);
      host = document.querySelector('#manualOrdersAdmin');
    }
    if (!host) return;
    host.innerHTML = '<div class="empty-state pulse-soft">Loading payment requests...</div>';
    const { data, error } = await sb.from('manual_orders').select('*').order('created_at',{ascending:false}).limit(100);
    if (error) { host.innerHTML = `<div class="empty-state"><b>Cannot load payments</b><br>${error.message}<br><small>Run NEXT_UPGRADE_MANUAL_PAYMENTS_SQL.sql</small></div>`; return; }
    const rows = data || [];
    host.innerHTML = rows.map(o => `<article class="order-card-premium ${o.status || 'pending'}">
      <div class="order-top"><h3>${escapeHtml(o.service_title || 'Payment')}</h3><span class="status-pill ${o.status || 'pending'}">${escapeHtml(o.status || 'pending')}</span></div>
      <div class="order-meta"><span><b>Amount:</b> ${rupee(o.amount_inr)}</span><span><b>UTR:</b> ${escapeHtml(o.reference_number || 'missing')}</span><span><b>Commission:</b> ${rupee(o.commission_inr)}</span><span><b>Seller payout:</b> ${rupee(o.seller_payout_inr)}</span></div>
      <small>${new Date(o.created_at || Date.now()).toLocaleString()}</small>
      <div class="proof-actions"><button class="mini" onclick="viewPaymentProofV2('${escapeHtml(o.proof_path || '')}')">View Proof</button>${o.status === 'pending' ? `<button class="mini success" onclick="approveManualOrderV2('${o.id}')">Approve</button><button class="mini danger" onclick="rejectManualOrderV2('${o.id}')">Reject</button>` : ''}${o.status === 'approved' && o.seller_id ? `<button class="mini" onclick="markSellerPaidV2('${o.id}')">Mark Seller Paid</button>` : ''}</div>
    </article>`).join('') || '<div class="empty-state">No manual payment requests yet.</div>';
  }

  window.viewPaymentProofV2 = async function(path){ const url = await signedProofUrl(path); if (url) window.open(url, '_blank'); else say('Proof unavailable'); };
  window.approveManualOrderV2 = async function(id){
    if (!sb || !admin()) return;
    const { data: order } = await sb.from('manual_orders').select('*').eq('id',id).single();
    const { error } = await sb.from('manual_orders').update({status:'approved', approved_at:new Date().toISOString()}).eq('id',id);
    if (error) return say(error.message);
    if (order?.buyer_id && order?.item_type === 'plan') {
      await sb.from('profiles').update({plan_key:order.plan_key || 'premium', is_verified:true}).eq('id', order.buyer_id).then(undefined,()=>{});
    }
    if (order?.seller_id) {
      const { data: seller } = await sb.from('profiles').select('pending_payout_inr,total_earned_inr').eq('id', order.seller_id).single().then(undefined,()=>({data:null}));
      await sb.from('profiles').update({
        pending_payout_inr: Number(seller?.pending_payout_inr||0) + Number(order.seller_payout_inr||0),
        total_earned_inr: Number(seller?.total_earned_inr||0) + Number(order.seller_payout_inr||0)
      }).eq('id', order.seller_id).then(undefined,()=>{});
    }
    await sb.from('notifications').insert({user_id:order?.buyer_id, type:'payment_approved', content:'Your payment was approved. Access is now active.'}).then(undefined,()=>{});
    say('Payment approved. Buyer access activated.');
    renderManualOrdersAdminV2();
  };
  window.rejectManualOrderV2 = async function(id){
    if (!sb || !admin()) return;
    const { data: order } = await sb.from('manual_orders').select('buyer_id').eq('id',id).single().then(undefined,()=>({data:null}));
    const { error } = await sb.from('manual_orders').update({status:'rejected'}).eq('id',id);
    if (error) return say(error.message);
    if (order?.buyer_id) await sb.from('notifications').insert({user_id:order.buyer_id, type:'payment_rejected', content:'Your payment proof was rejected. Please upload a clearer screenshot with UTR.'}).then(undefined,()=>{});
    say('Payment rejected'); renderManualOrdersAdminV2();
  };
  window.markSellerPaidV2 = async function(id){
    if (!sb || !admin()) return;
    const { data: order } = await sb.from('manual_orders').select('*').eq('id',id).single();
    const { error } = await sb.from('manual_orders').update({payout_status:'paid', payout_paid_at:new Date().toISOString()}).eq('id',id);
    if (error) return say(error.message);
    if (order?.seller_id) {
      const { data: seller } = await sb.from('profiles').select('pending_payout_inr,paid_payout_inr').eq('id', order.seller_id).single().then(undefined,()=>({data:null}));
      await sb.from('profiles').update({
        pending_payout_inr: Math.max(0, Number(seller?.pending_payout_inr||0) - Number(order.seller_payout_inr||0)),
        paid_payout_inr: Number(seller?.paid_payout_inr||0) + Number(order.seller_payout_inr||0)
      }).eq('id', order.seller_id).then(undefined,()=>{});
    }
    say('Seller payout marked paid'); renderManualOrdersAdminV2();
  };

  async function renderSellerWalletV2(){
    if (!sb || !session?.user) return;
    let host = document.querySelector('#sellerWalletPanel');
    const market = document.querySelector('#market');
    if (!host && market) {
      market.insertAdjacentHTML('beforeend', `<section id="sellerWalletPanel" class="panel"><div class="panel-head"><h2>Seller Wallet</h2><span class="chip">Earnings</span></div><div id="sellerWalletBody"></div></section>`);
      host = document.querySelector('#sellerWalletPanel');
    }
    const body = document.querySelector('#sellerWalletBody'); if (!body) return;
    const { data } = await sb.from('manual_orders').select('*').eq('seller_id', session.user.id).order('created_at',{ascending:false}).limit(50).then(undefined,()=>({data:[]}));
    const rows = data || [];
    const approved = rows.filter(x=>x.status==='approved');
    const pendingPay = approved.filter(x=>x.payout_status!=='paid').reduce((a,x)=>a+Number(x.seller_payout_inr||0),0);
    const paid = approved.filter(x=>x.payout_status==='paid').reduce((a,x)=>a+Number(x.seller_payout_inr||0),0);
    body.innerHTML = `<div class="wallet-grid"><div class="wallet-stat"><b>${rupee(pendingPay)}</b><small>Pending payout</small></div><div class="wallet-stat"><b>${rupee(paid)}</b><small>Paid out</small></div><div class="wallet-stat"><b>${approved.length}</b><small>Approved orders</small></div></div>${rows.slice(0,6).map(o=>`<div class="manual-order-card ${o.status}"><b>${escapeHtml(o.service_title||'Order')}</b><small>${rupee(o.seller_payout_inr)} payout · ${escapeHtml(o.status)} · ${escapeHtml(o.payout_status || 'pending payout')}</small></div>`).join('') || '<p class="muted">No seller orders yet.</p>'}`;
  }

  // Override all old payment hooks to manual UPI only.
  window.buyPlan = async function(planKey){ const plan = (demo?.plans||[]).find(p=>p.key===planKey); if(!plan) return say('Plan not found'); if(Number(plan.price_inr||0)<=0) return say('Free plan is already available'); return openManualPaymentV2({id:plan.key,key:plan.key,plan_key:plan.key,type:'plan',name:`StackOps ${plan.name} Plan`,amount:Number(plan.price_inr||0)}); };
  window.buy = async function(name, amount, type='service'){ return openManualPaymentV2({name,title:name,amount:Number(amount||0),type}); };
  window.openManualPaymentForService = async function(id){
    let svc = (demo?.services||[]).find(x=>String(x.id)===String(id));
    if (sb && !svc) { const r = await sb.from('seller_services').select('*').eq('id', id).single().then(undefined,()=>({data:null})); svc = r.data; }
    if (!svc) return say('Service not found');
    return openManualPaymentV2({ ...svc, type:'service', amount:Number(svc.price_inr||svc.amount||0) });
  };
  try { startRazorpayCheckout = async function({name,amount,type='service',plan_key=null}){ return openManualPaymentV2({name,amount,type,plan_key}); }; } catch(e){}

  const oldAdmin = window.renderAdmin || (typeof renderAdmin !== 'undefined' ? renderAdmin : null);
  if (oldAdmin) { renderAdmin = async function(){ await oldAdmin?.(); setTimeout(renderManualOrdersAdminV2, 80); }; window.renderAdmin = renderAdmin; }
  const oldSwitch2 = window.switchView || (typeof switchView !== 'undefined' ? switchView : null);
  if (oldSwitch2) { switchView = function(id){ oldSwitch2(id); if(id==='admin') setTimeout(renderManualOrdersAdminV2,120); if(id==='market') setTimeout(renderSellerWalletV2,250); }; window.switchView = switchView; }
  document.addEventListener('DOMContentLoaded', ()=>{ ensureModal2(); setTimeout(()=>{ renderManualOrdersAdminV2(); renderSellerWalletV2(); }, 1200); });
})();

/* ===== FINAL PATCH: secure admin system + no-stuck intro ===== */
(function(){
  function hideBoot(){
    try { document.getElementById('boot')?.classList.add('hide'); } catch(e) {}
  }
  setTimeout(hideBoot, 1600);
  window.addEventListener('error', function(){ setTimeout(hideBoot, 100); });
  window.addEventListener('unhandledrejection', function(){ setTimeout(hideBoot, 100); });
  window.addEventListener('load', function(){ setTimeout(hideBoot, 500); });

  function safeText(v){
    try { return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
    catch(e){ return ''; }
  }
  function inr(v){
    try { return typeof money === 'function' ? money(v) : '₹' + Number(v || 0).toLocaleString('en-IN'); }
    catch(e){ return '₹' + (v || 0); }
  }
  function isFounder(){
    try { return typeof isAdmin === 'function' && isAdmin(); } catch(e){ return false; }
  }
  function notify(msg){
    try { if (typeof toast === 'function') return toast(msg); } catch(e) {}
    alert(msg);
  }
  async function signedProof(path){
    try {
      if (!path || !window.sb) return '';
      const { data } = await sb.storage.from('payment-proofs').createSignedUrl(path, 600);
      return data?.signedUrl || '';
    } catch(e) { return ''; }
  }

  window.stackopsSecureAdminLoadPayments = async function(){
    const host = document.querySelector('#manualOrdersAdmin');
    if (!host || !window.sb || !isFounder()) return;
    host.innerHTML = '<div class="empty-state pulse-soft">Loading secure payment queue...</div>';
    const { data, error } = await sb.from('manual_orders').select('*').order('created_at',{ascending:false}).limit(100);
    if (error) {
      host.innerHTML = `<div class="error-card"><b>Cannot load payments</b><br>${safeText(error.message)}<br><small>Run SECURE_ADMIN_MANUAL_PAYMENTS_SQL.sql from this ZIP.</small></div>`;
      return;
    }
    const rows = data || [];
    host.innerHTML = rows.length ? rows.map(o => {
      const status = safeText(o.status || 'pending');
      const payout = safeText(o.payout_status || 'pending');
      const proof = safeText(o.proof_path || '');
      return `<article class="order-card-premium ${status}">
        <div class="order-top"><h3>${safeText(o.service_title || o.item_type || 'Manual Payment')}</h3><span class="status-pill ${status}">${status}</span></div>
        <div class="order-meta">
          <span><b>Amount:</b> ${inr(o.amount_inr)}</span>
          <span><b>UTR:</b> ${safeText(o.reference_number || 'missing')}</span>
          <span><b>Commission:</b> ${inr(o.commission_inr)}</span>
          <span><b>Seller payout:</b> ${inr(o.seller_payout_inr)}</span>
          <span><b>Payout:</b> ${payout}</span>
          <span><b>Submitted:</b> ${new Date(o.created_at || Date.now()).toLocaleString()}</span>
        </div>
        <div class="proof-actions">
          <button class="mini" onclick="stackopsOpenProof('${proof}')">View Proof</button>
          ${status === 'pending' ? `<button class="mini success" onclick="stackopsApproveOrder('${o.id}')">Approve</button><button class="mini danger" onclick="stackopsRejectOrder('${o.id}')">Reject</button>` : ''}
          ${status === 'approved' && payout !== 'paid' ? `<button class="mini" onclick="stackopsMarkSellerPaid('${o.id}')">Mark Seller Paid</button>` : ''}
        </div>
      </article>`;
    }).join('') : '<div class="empty-state">No manual payment requests yet.</div>';
  };

  window.stackopsOpenProof = async function(path){
    const url = await signedProof(path);
    if (!url) return notify('Proof not available. Check storage policy or proof path.');
    window.open(url, '_blank');
  };
  window.stackopsApproveOrder = async function(id){
    if (!window.sb || !isFounder()) return notify('Admin only');
    const { data: order } = await sb.from('manual_orders').select('*').eq('id',id).single().then(r=>r).catch(()=>({data:null}));
    const { error } = await sb.from('manual_orders').update({ status:'approved', approved_at:new Date().toISOString() }).eq('id', id);
    if (error) return notify(error.message);
    try {
      if (order?.buyer_id && order?.item_type === 'plan') await sb.from('profiles').update({ plan_key: order.plan_key || 'premium', is_verified: true }).eq('id', order.buyer_id);
      if (order?.seller_id) {
        const { data: seller } = await sb.from('profiles').select('pending_payout_inr,total_earned_inr').eq('id', order.seller_id).single().then(r=>r).catch(()=>({data:null}));
        await sb.from('profiles').update({
          pending_payout_inr: Number(seller?.pending_payout_inr || 0) + Number(order.seller_payout_inr || 0),
          total_earned_inr: Number(seller?.total_earned_inr || 0) + Number(order.seller_payout_inr || 0)
        }).eq('id', order.seller_id);
      }
      if (order?.buyer_id) await sb.from('notifications').insert({ user_id: order.buyer_id, type:'payment_approved', content:'Your StackOps payment was approved. Access is now active.' });
    } catch(e) {}
    notify('Payment approved');
    stackopsSecureAdminLoadPayments();
  };
  window.stackopsRejectOrder = async function(id){
    if (!window.sb || !isFounder()) return notify('Admin only');
    const { data: order } = await sb.from('manual_orders').select('buyer_id').eq('id',id).single().then(r=>r).catch(()=>({data:null}));
    const { error } = await sb.from('manual_orders').update({ status:'rejected' }).eq('id', id);
    if (error) return notify(error.message);
    try { if (order?.buyer_id) await sb.from('notifications').insert({ user_id: order.buyer_id, type:'payment_rejected', content:'Your payment proof was rejected. Upload a clearer screenshot with UTR/reference visible.' }); } catch(e) {}
    notify('Payment rejected');
    stackopsSecureAdminLoadPayments();
  };
  window.stackopsMarkSellerPaid = async function(id){
    if (!window.sb || !isFounder()) return notify('Admin only');
    const { data: order } = await sb.from('manual_orders').select('*').eq('id',id).single().then(r=>r).catch(()=>({data:null}));
    const { error } = await sb.from('manual_orders').update({ payout_status:'paid', payout_paid_at:new Date().toISOString() }).eq('id', id);
    if (error) return notify(error.message);
    try {
      if (order?.seller_id) {
        const { data: seller } = await sb.from('profiles').select('pending_payout_inr,paid_payout_inr').eq('id', order.seller_id).single().then(r=>r).catch(()=>({data:null}));
        await sb.from('profiles').update({
          pending_payout_inr: Math.max(0, Number(seller?.pending_payout_inr || 0) - Number(order.seller_payout_inr || 0)),
          paid_payout_inr: Number(seller?.paid_payout_inr || 0) + Number(order.seller_payout_inr || 0)
        }).eq('id', order.seller_id);
      }
    } catch(e) {}
    notify('Seller payout marked paid');
    stackopsSecureAdminLoadPayments();
  };

  // Hook into existing admin view after legacy render finishes.
  const attach = function(){
    try {
      const admin = document.querySelector('#admin');
      const adminGrid = document.querySelector('#admin .admin-grid') || admin;
      if (admin && adminGrid && !document.querySelector('#manualOrdersAdmin')) {
        adminGrid.insertAdjacentHTML('beforeend', `<section class="panel manual-admin-panel"><div class="panel-head"><div><h2>Manual Payment Requests</h2><span class="secure-admin-badge">🔒 Secure admin queue</span></div><span class="chip">Middleman escrow</span></div><div id="manualOrdersAdmin" class="admin-list"></div></section>`);
      }
      stackopsSecureAdminLoadPayments();
    } catch(e) {}
  };
  const oldSwitch = window.switchView || (typeof switchView !== 'undefined' ? switchView : null);
  if (oldSwitch) {
    window.switchView = switchView = function(id){
      oldSwitch(id);
      if (id === 'admin') setTimeout(attach, 220);
    };
  }
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(attach, 1800); });
})();
