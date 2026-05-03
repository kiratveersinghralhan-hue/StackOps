/* StackOps final action wiring patch: keeps all buttons working after flat deploy. */
(() => {
  const cfg = window.STACKOPS_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  let client = null;
  let currentUser = null;
  let currentProfile = null;
  let paymentContext = null;
  const adminEmails = (cfg.ADMIN_EMAILS || []).map(e => String(e).toLowerCase());
  const upiId = cfg.MANUAL_UPI_ID || 'ralhanx@ptaxis';
  const upiQR = cfg.MANUAL_UPI_QR_URL || 'upi.jpeg';

  function toast(msg) {
    const t = $('#toast');
    if (t) {
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(window.__stackopsFinalToast);
      window.__stackopsFinalToast = setTimeout(() => t.classList.remove('show'), 2800);
    } else alert(msg);
  }
  function money(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
  function isAdmin() { return !!(currentProfile?.role === 'admin' || adminEmails.includes(String(currentUser?.email || '').toLowerCase())); }
  function isSeller() { return !!(currentProfile?.is_seller || currentProfile?.seller_status === 'approved' || isAdmin()); }
  function needLogin() { if (!currentUser) { $('#authModal')?.classList.add('active'); toast('Login required'); return true; } return false; }
  function safeText(v) { return String(v ?? '').replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m])); }
  function commission(amount) {
    amount = Number(amount || 0);
    const r = (cfg.COMMISSION_RULES || []).find(x => amount >= Number(x.min || 0) && amount <= Number(x.max || 999999999));
    const pct = Number(r?.percent ?? (amount >= 5000 ? 30 : amount >= 3000 ? 25 : amount >= 2000 ? 20 : amount >= 1000 ? 15 : amount >= 500 ? 10 : 7));
    return Math.ceil(amount * pct / 100);
  }
  function bindClick(id, handler) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e) => { e.preventDefault(); e.stopImmediatePropagation(); handler(e); }, true);
  }
  function bindSubmit(id, handler) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); handler(e); }, true);
  }

  function initClient() {
    if (client) return client;
    if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || String(cfg.SUPABASE_URL).includes('YOUR_')) return null;
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    return client;
  }
  async function loadAuth() {
    const sb = initClient();
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    currentUser = data?.session?.user || null;
    if (currentUser) await loadProfile();
    updateAuthUI();
  }
  async function ensureProfile() {
    const sb = initClient();
    if (!sb || !currentUser) return null;
    const base = {
      id: currentUser.id,
      username: String(currentUser.email || 'player').split('@')[0],
      display_name: String(currentUser.email || 'Player').split('@')[0],
      role: adminEmails.includes(String(currentUser.email || '').toLowerCase()) ? 'admin' : 'user',
      account_status: 'approved',
      seller_status: 'none',
      is_seller: false,
      plan_key: 'free',
      xp: 0
    };
    await sb.from('profiles').upsert(base, { onConflict: 'id', ignoreDuplicates: false });
    return base;
  }
  async function loadProfile() {
    const sb = initClient();
    if (!sb || !currentUser) { currentProfile = null; return; }
    let { data, error } = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    if (error || !data) {
      await ensureProfile();
      ({ data } = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle());
    }
    currentProfile = data || { id: currentUser.id, username: currentUser.email?.split('@')[0], role: adminEmails.includes(currentUser.email?.toLowerCase()) ? 'admin' : 'user' };
    if (adminEmails.includes(String(currentUser.email || '').toLowerCase()) && currentProfile.role !== 'admin') {
      await sb.from('profiles').update({ role:'admin', account_status:'approved' }).eq('id', currentUser.id);
      currentProfile.role = 'admin';
    }
  }
  function updateAuthUI() {
    const open = $('#openAuth');
    if (open) open.textContent = currentUser ? 'Logout' : 'Login';
    $$('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin()));
    const sellerChip = $('#sellerStatusChip');
    if (sellerChip) sellerChip.textContent = isSeller() ? 'Seller active' : 'Not seller';
    const apply = $('#applySellerBtn');
    if (apply) apply.textContent = isSeller() ? 'Seller Active' : (currentProfile?.seller_status === 'pending' ? 'Application Pending' : 'Apply to Sell');
    const name = currentProfile?.display_name || currentProfile?.username || currentUser?.email?.split('@')[0] || 'Guest';
    ['profileName','heroName','accountName'].forEach(id => { const el = $('#'+id); if (el) el.textContent = name; });
  }

  function switchView(id) {
    if (!id) return;
    $$('.view').forEach(v => v.classList.toggle('active', v.id === id));
    $$('.nav').forEach(n => n.classList.toggle('active', n.dataset.view === id));
    $('#mobileMenu')?.classList.remove('open');
    window.scrollTo({top:0, behavior:'smooth'});
    if (id === 'sellerDashboard') loadSellerDashboard();
    if (id === 'market') loadMarketplaceServices();
    if (id === 'admin') { loadAdminSellerApps(); loadAdminManualOrders(); loadAdminPayouts(); }
  }
  window.switchView = switchView;

  async function login() {
    const sb = initClient();
    if (!sb) return toast('Supabase not configured');
    const email = $('#email')?.value?.trim().toLowerCase();
    const password = $('#password')?.value;
    if (!email || !password) return toast('Enter email and password');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return toast('Login failed: ' + error.message);
    currentUser = data.user;
    await loadProfile();
    updateAuthUI();
    $('#authModal')?.classList.remove('active');
    toast('Logged in');
  }
  async function signup() {
    const sb = initClient();
    if (!sb) return toast('Supabase not configured');
    const email = $('#email')?.value?.trim().toLowerCase();
    const password = $('#password')?.value;
    if (!email || !password) return toast('Enter email and password');
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) return toast('Signup failed: ' + error.message);
    currentUser = data.user || null;
    if (currentUser) await ensureProfile();
    toast('Signup successful. Login if session did not start automatically.');
    updateAuthUI();
  }
  async function logout() {
    const sb = initClient();
    if (sb) await sb.auth.signOut();
    currentUser = null; currentProfile = null;
    updateAuthUI();
    toast('Logged out');
  }

  async function applySeller() {
    const sb = initClient();
    if (needLogin() || !sb) return;
    await loadProfile();
    if (isSeller()) return toast('Seller account already active');
    const existing = await sb.from('seller_applications').select('id,status').eq('user_id', currentUser.id).maybeSingle();
    if (existing.data?.id && existing.data.status !== 'rejected') {
      await sb.from('profiles').update({ seller_status: existing.data.status || 'pending' }).eq('id', currentUser.id);
      toast(existing.data.status === 'approved' ? 'Already approved' : 'Application already pending');
      await loadProfile(); updateAuthUI(); return;
    }
    const payload = {
      user_id: currentUser.id,
      applicant_email: currentUser.email || '',
      applicant_name: currentProfile?.display_name || currentProfile?.username || currentUser.email || 'StackOps Player',
      note: 'Seller/coach application from StackOps marketplace',
      status: 'pending'
    };
    const { error } = await sb.from('seller_applications').upsert(payload, { onConflict:'user_id' });
    if (error) return toast('Apply failed: ' + error.message);
    await sb.from('profiles').update({ seller_status:'pending' }).eq('id', currentUser.id);
    await loadProfile(); updateAuthUI();
    toast('Seller application submitted for admin approval');
  }

  async function createTeam() {
    const sb = initClient();
    if (needLogin() || !sb) return;
    const team = {
      owner_id: currentUser.id,
      name: $('#teamName')?.value?.trim(),
      game: $('#teamGame')?.value || 'Valorant',
      region: $('#teamRegion')?.value?.trim(),
      rank_required: $('#teamRank')?.value?.trim(),
      description: $('#teamDescription')?.value?.trim()
    };
    if (!team.name) return toast('Enter team name');
    const { error } = await sb.from('teams').insert(team);
    if (error) return toast('Team failed: ' + error.message);
    $('#teamModal')?.classList.remove('active');
    $('#teamForm')?.reset();
    toast('Team created');
  }

  async function createPost() {
    const sb = initClient();
    if (needLogin() || !sb) return;
    const content = $('#postContent')?.value?.trim();
    if (!content) return toast('Write something first');
    const { error } = await sb.from('posts').insert({ user_id: currentUser.id, content });
    if (error) return toast('Post failed: ' + error.message);
    $('#postContent').value = '';
    toast('Post published');
  }

  async function createService() {
    const sb = initClient();
    if (needLogin() || !sb) return;
    await loadProfile();
    if (!isSeller()) return toast('Only approved sellers can create services');
    const title = $('#serviceTitle')?.value?.trim();
    const game = $('#serviceGame')?.value?.trim() || 'Valorant';
    const price = Number($('#servicePrice')?.value || 0);
    const description = $('#serviceDescription')?.value?.trim();
    if (!title || !price || price < 1) return toast('Enter service title and price');
    const { error } = await sb.from('seller_services').insert({ seller_id: currentUser.id, title, game, price_inr: price, description, status:'active' });
    if (error) return toast('Service failed: ' + error.message);
    ['serviceTitle','serviceGame','servicePrice','serviceDescription'].forEach(id => { const el = $('#'+id); if (el) el.value = ''; });
    toast('Service created');
    loadSellerDashboard(); loadMarketplaceServices();
  }

  window.openManualPayment = function(ctx) {
    if (needLogin()) return;
    paymentContext = ctx || {};
    $('#manualPayTitle') && ($('#manualPayTitle').textContent = paymentContext.name || 'Complete Payment');
    $('#manualPayAmount') && ($('#manualPayAmount').textContent = money(paymentContext.amount || 0));
    $('#manualPayUPI') && ($('#manualPayUPI').textContent = upiId);
    $('#manualPayQR') && ($('#manualPayQR').src = upiQR);
    $('#manualPayUTR') && ($('#manualPayUTR').value = '');
    $('#manualPayProof') && ($('#manualPayProof').value = '');
    $('#manualPaymentModal')?.classList.add('show');
  };
  window.buyPlan = function(planKey) {
    const plans = [
      {key:'bronze', name:'Bronze', price_inr:199}, {key:'silver', name:'Silver', price_inr:499},
      {key:'gold', name:'Gold', price_inr:999}, {key:'diamond', name:'Diamond', price_inr:2499}, {key:'legend', name:'Legend', price_inr:5999}
    ];
    const plan = plans.find(p => p.key === planKey);
    if (!plan) return toast('Free plan is already available');
    window.openManualPayment({ name:`StackOps ${plan.name} Plan`, amount:plan.price_inr, item_type:'plan', plan_key:plan.key });
  };
  window.buy = function(name, amount, type='service') { window.openManualPayment({ name, amount, item_type:type }); };
  window.orderSellerService = function(serviceId, name, amount, sellerId) { window.openManualPayment({ name, amount, item_type:'service', service_id:serviceId, seller_id:sellerId }); };

  async function submitManualPayment() {
    const sb = initClient();
    if (needLogin() || !sb) return;
    const utr = $('#manualPayUTR')?.value?.trim();
    const file = $('#manualPayProof')?.files?.[0];
    if (!utr) return toast('Enter UTR / Reference number');
    if (!file) return toast('Upload payment screenshot with UTR visible');
    const amount = Number(paymentContext?.amount || 0);
    const path = `${currentUser.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g,'_')}`;
    const up = await sb.storage.from('payment-proofs').upload(path, file, { upsert:false });
    if (up.error) return toast('Screenshot upload failed: ' + up.error.message);
    const c = commission(amount);
    const order = {
      buyer_id: currentUser.id,
      seller_id: paymentContext?.seller_id || null,
      item_name: paymentContext?.name || 'StackOps purchase',
      item_type: paymentContext?.item_type || 'service',
      plan_key: paymentContext?.plan_key || null,
      amount_inr: amount,
      commission_inr: c,
      seller_earning_inr: Math.max(0, amount - c),
      utr,
      proof_url: path,
      status: 'pending',
      is_feedback_public: !!$('#manualPayPublicFeedback')?.checked,
      feedback_text: 'Payment submitted for StackOps verification.'
    };
    const { error } = await sb.from('manual_orders').insert(order);
    if (error) return toast('Payment submit failed: ' + error.message);
    $('#manualPaymentModal')?.classList.remove('show');
    toast('Payment submitted. It will reflect in your account within 24–48 hours after verification.');
  }

  async function loadMarketplaceServices() {
    const sb = initClient(); const el = $('#serviceList'); if (!sb || !el) return;
    const { data, error } = await sb.from('seller_services').select('*').eq('status','active').order('created_at',{ascending:false});
    if (error || !data?.length) { el.innerHTML = '<div class="empty-state">No real seller services yet. Approved sellers can upload services from Seller Dashboard.</div>'; return; }
    el.innerHTML = data.map(s => `<article class="card service-card"><span class="chip">${safeText(s.game||'Gaming')}</span><h3>${safeText(s.title)}</h3><p>${safeText(s.description||'')}</p><div class="card-foot"><b>${money(s.price_inr)}</b><button class="btn primary" onclick="orderSellerService('${s.id}','${safeText(s.title).replace(/'/g,'&#39;')}',${Number(s.price_inr||0)},'${s.seller_id||''}')">Buy</button></div></article>`).join('');
  }
  async function loadSellerDashboard() {
    const sb = initClient(); if (!sb || !currentUser) return;
    const status = $('#sellerStatusChip'); if (status) status.textContent = isSeller() ? 'Seller active' : 'Not seller';
    if (!isSeller()) return;
    const { data: services } = await sb.from('seller_services').select('*').eq('seller_id', currentUser.id).order('created_at',{ascending:false});
    const svc = $('#sellerServiceList');
    if (svc) svc.innerHTML = (services||[]).map(x => `<div class="seller-row"><div><b>${safeText(x.title)}</b><small>${safeText(x.game||'Game')} · ${safeText(x.description||'')}</small></div><div>${money(x.price_inr)}</div><div>${safeText(x.status)}</div></div>`).join('') || '<div class="empty-state">No services yet. Create your first listing.</div>';
  }
  async function loadAdminSellerApps() {
    const sb = initClient(); const el = $('#sellerApplicationsList') || $('#adminSellers'); if (!sb || !el || !isAdmin()) return;
    const { data } = await sb.from('seller_applications').select('*').order('created_at',{ascending:false});
    el.innerHTML = (data||[]).map(a => `<div class="user-row"><b>${safeText(a.applicant_name || a.applicant_email || a.user_id)}</b><small>${safeText(a.status||'pending')} · ${safeText(a.applicant_email||'')}</small>${a.status!=='approved'?`<button class="mini" onclick="approveSellerFinal('${a.id}')">Approve</button>`:''}${a.status!=='rejected'?`<button class="mini danger" onclick="rejectSellerFinal('${a.id}')">Reject</button>`:''}${a.status==='approved'?`<button class="mini danger" onclick="unapproveSellerFinal('${a.id}')">Unapprove</button>`:''}</div>`).join('') || 'No seller applications';
  }
  window.approveSellerFinal = async function(id) {
    const sb = initClient(); if (!sb) return;
    const { data: app } = await sb.from('seller_applications').select('*').eq('id', id).maybeSingle();
    if (!app) return toast('Application not found');
    await sb.from('seller_applications').update({ status:'approved', reviewed_at:new Date().toISOString() }).eq('id', id);
    await sb.from('profiles').update({ is_seller:true, seller_status:'approved' }).eq('id', app.user_id);
    toast('Seller approved'); loadAdminSellerApps();
  };
  window.rejectSellerFinal = async function(id) { const sb = initClient(); await sb.from('seller_applications').update({ status:'rejected', reviewed_at:new Date().toISOString() }).eq('id', id); toast('Seller rejected'); loadAdminSellerApps(); };
  window.unapproveSellerFinal = async function(id) {
    const sb = initClient(); const { data: app } = await sb.from('seller_applications').select('*').eq('id', id).maybeSingle();
    if (app) await sb.from('profiles').update({ is_seller:false, seller_status:'none' }).eq('id', app.user_id);
    await sb.from('seller_applications').update({ status:'pending' }).eq('id', id); toast('Seller moved to pending'); loadAdminSellerApps();
  };
  async function loadAdminManualOrders() { /* existing admin UI can load this; this patch keeps approve functions available */ }
  async function loadAdminPayouts() {}
  window.adminOrderStatus = async function(id,status) { const sb = initClient(); await sb.from('manual_orders').update({ status, approved_at: status==='approved'?new Date().toISOString():null, rejected_at: status==='rejected'?new Date().toISOString():null }).eq('id', id); toast('Order ' + status); };
  window.adminPayoutStatus = async function(id,status) { const sb = initClient(); await sb.from('seller_payouts').update({ status, paid_at: status==='paid'?new Date().toISOString():null }).eq('id', id); toast('Payout ' + status); };

  document.addEventListener('DOMContentLoaded', async () => {
    $('#boot')?.classList.add('hide');
    setTimeout(() => $('#boot')?.remove(), 1200);
    await loadAuth();
    const sb = initClient();
    if (sb) sb.auth.onAuthStateChange(async (_event, session) => { currentUser = session?.user || null; if (currentUser) await loadProfile(); else currentProfile = null; updateAuthUI(); });

    $$('.nav').forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); switchView(btn.dataset.view); }, true));
    bindClick('openAuth', () => currentUser ? logout() : $('#authModal')?.classList.add('active'));
    bindClick('closeAuth', () => $('#authModal')?.classList.remove('active'));
    bindClick('loginBtn', login);
    bindClick('signupBtn', signup);
    bindClick('saveLanguage', () => $('#languageModal')?.classList.remove('active'));
    bindClick('hamb', () => $('#mobileMenu')?.classList.toggle('open'));
    bindClick('applySellerBtn', applySeller);
    bindClick('createPostBtn', createPost);
    bindClick('createServiceBtn', createService);
    bindClick('requestPayoutBtn', async () => toast('Payout requests are available after completed approved orders.'));
    bindClick('submitManualPayment', submitManualPayment);
    bindClick('copyManualUPI', async () => { try { await navigator.clipboard.writeText(upiId); } catch {} toast('UPI copied'); });
    bindClick('closeManualPay', () => $('#manualPaymentModal')?.classList.remove('show'));
    bindClick('refreshSellerDashboard', loadSellerDashboard);
    bindClick('refreshAdminOrders', () => { loadAdminSellerApps(); });
    bindSubmit('teamForm', createTeam);
    bindClick('newTeamBtn', () => needLogin() ? null : $('#teamModal')?.classList.add('active'));
    bindClick('themeToggle', () => document.body.classList.toggle('light'));
    bindClick('scrollTop', () => window.scrollTo({top:0, behavior:'smooth'}));

    loadMarketplaceServices(); loadSellerDashboard(); loadAdminSellerApps();
  });
})();
