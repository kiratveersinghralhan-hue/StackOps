/* StackOps GO LIVE button fixer - safe, simple, no Razorpay. */
(function () {
  'use strict';
  const cfg = window.STACKOPS_CONFIG || {};
  const ADMIN_EMAILS = (cfg.ADMIN_EMAILS || ['kiratveersinghralhan@gmail.com','qq299629@gmail.com']).map(x => String(x).toLowerCase());
  const UPI_ID = cfg.MANUAL_UPI_ID || 'ralhanx@ptaxis';
  const UPI_QR = cfg.MANUAL_UPI_QR_URL || 'upi.jpeg';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  let sb = null;
  let user = null;
  let profile = null;
  let payment = null;

  function toast(msg) {
    const t = $('#toast');
    if (t) {
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(window.__stackopsToastTimer);
      window.__stackopsToastTimer = setTimeout(() => t.classList.remove('show'), 3300);
    } else alert(msg);
  }
  function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m])); }
  function money(v) { return '₹' + Number(v || 0).toLocaleString('en-IN'); }
  function getClient() {
    if (sb) return sb;
    if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return null;
    try { sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY); } catch (e) { console.error(e); }
    return sb;
  }
  function isAdmin() { return ADMIN_EMAILS.includes(String(user?.email || '').toLowerCase()) || profile?.role === 'admin'; }
  function isSeller() { return isAdmin() || profile?.is_seller === true || profile?.seller_status === 'approved'; }
  function commission(amount) {
    amount = Number(amount || 0);
    if (amount >= 5000) return Math.ceil(amount * 0.30);
    if (amount >= 3000) return Math.ceil(amount * 0.25);
    if (amount >= 2000) return Math.ceil(amount * 0.20);
    if (amount >= 1000) return Math.ceil(amount * 0.15);
    if (amount >= 500) return Math.ceil(amount * 0.10);
    return Math.ceil(amount * 0.07);
  }
  function needLogin() {
    if (!user) {
      openModal('authModal');
      toast('Please login first.');
      return true;
    }
    return false;
  }
  function openModal(id) { const el = document.getElementById(id); if (el) { el.classList.add('active'); el.classList.add('show'); } }
  function closeModal(id) { const el = document.getElementById(id); if (el) { el.classList.remove('active'); el.classList.remove('show'); } }
  function bindClick(id, fn) {
    const el = document.getElementById(id);
    if (!el || el.dataset.stackopsBound === '1') return;
    el.dataset.stackopsBound = '1';
    el.addEventListener('click', function(e){ e.preventDefault(); e.stopImmediatePropagation(); fn(e); }, true);
  }
  function bindSubmit(id, fn) {
    const el = document.getElementById(id);
    if (!el || el.dataset.stackopsBound === '1') return;
    el.dataset.stackopsBound = '1';
    el.addEventListener('submit', function(e){ e.preventDefault(); e.stopImmediatePropagation(); fn(e); }, true);
  }

  async function loadSession() {
    const c = getClient();
    if (!c) { updateUI(); return; }
    try {
      const { data } = await c.auth.getSession();
      user = data?.session?.user || null;
      if (user) await loadProfile();
      updateUI();
    } catch (e) { console.error('session load failed', e); updateUI(); }
  }
  async function loadProfile() {
    const c = getClient();
    if (!c || !user) { profile = null; return; }
    try {
      const base = {
        id: user.id,
        username: String(user.email || 'player').split('@')[0],
        display_name: String(user.email || 'Player').split('@')[0],
        role: ADMIN_EMAILS.includes(String(user.email || '').toLowerCase()) ? 'admin' : 'user',
        account_status: 'approved',
        seller_status: 'none',
        is_seller: false,
        plan_key: 'free',
        xp: 0
      };
      let res = await c.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (res.error || !res.data) {
        await c.from('profiles').upsert(base, { onConflict: 'id' });
        res = await c.from('profiles').select('*').eq('id', user.id).maybeSingle();
      }
      profile = res.data || base;
      if (ADMIN_EMAILS.includes(String(user.email || '').toLowerCase()) && profile.role !== 'admin') {
        await c.from('profiles').update({ role: 'admin', account_status: 'approved', is_verified: true }).eq('id', user.id);
        profile.role = 'admin';
      }
    } catch (e) {
      console.warn('profile fallback', e);
      profile = { id: user.id, username: user.email?.split('@')[0], display_name: user.email?.split('@')[0], role: ADMIN_EMAILS.includes(String(user.email || '').toLowerCase()) ? 'admin' : 'user' };
    }
  }
  function updateUI() {
    const login = $('#openAuth');
    if (login) login.textContent = user ? 'Logout' : 'Login';
    const name = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'Guest';
    ['profileName','heroName','accountName'].forEach(id => { const el = $('#'+id); if (el) el.textContent = name; });
    $$('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin()));
    const chip = $('#sellerStatusChip'); if (chip) chip.textContent = isSeller() ? 'Seller active' : (profile?.seller_status === 'pending' ? 'Application pending' : 'Not seller');
    const apply = $('#applySellerBtn');
    if (apply) apply.textContent = isSeller() ? 'Seller Active' : (profile?.seller_status === 'pending' ? 'Application Pending' : 'Apply to Sell');
  }

  function switchView(viewId) {
    if (!viewId) return;
    $$('.view').forEach(v => v.classList.toggle('active', v.id === viewId));
    $$('.nav').forEach(n => n.classList.toggle('active', n.dataset.view === viewId));
    $('#mobileMenu')?.classList.remove('open');
    if (viewId === 'market') { renderPlans(); loadServices(); }
    if (viewId === 'sellerDashboard') loadSellerDashboard();
    if (viewId === 'admin' || viewId === 'sellerReview') { loadSellerApplications(); loadManualOrders(); loadPayouts(); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  window.switchView = switchView;

  async function login() {
    const c = getClient();
    if (!c) return toast('Supabase config missing.');
    const email = $('#email')?.value?.trim().toLowerCase();
    const password = $('#password')?.value;
    if (!email || !password) return toast('Enter email and password.');
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) return toast(error.message);
    user = data?.user || null;
    if (user) await loadProfile();
    closeModal('authModal');
    updateUI();
    toast('Logged in successfully.');
  }
  async function signup() {
    const c = getClient();
    if (!c) return toast('Supabase config missing.');
    const email = $('#email')?.value?.trim().toLowerCase();
    const password = $('#password')?.value;
    if (!email || !password) return toast('Enter email and password.');
    const { data, error } = await c.auth.signUp({ email, password });
    if (error) return toast(error.message);
    if (data?.user) { user = data.user; await loadProfile(); updateUI(); closeModal('authModal'); }
    toast('Signup done. If email confirmation is enabled, verify your email, then login.');
  }
  async function logout() {
    const c = getClient();
    if (c) await c.auth.signOut();
    user = null; profile = null; updateUI(); toast('Logged out.');
  }

  async function saveProfile(e) {
    if (needLogin()) return;
    const c = getClient();
    const update = {
      display_name: $('#displayName')?.value?.trim() || profile?.display_name || '',
      username: $('#username')?.value?.trim() || profile?.username || '',
      riot_id: $('#riotId')?.value?.trim() || null,
      region: $('#region')?.value?.trim() || null,
      main_game: $('#mainGame')?.value || 'Valorant',
      bio: $('#bio')?.value?.trim() || null
    };
    const { error } = await c.from('profiles').update(update).eq('id', user.id);
    if (error) return toast('Profile save failed: ' + error.message);
    await loadProfile(); updateUI(); toast('Profile saved.');
  }

  async function createTeam() {
    if (needLogin()) return;
    const c = getClient();
    const name = $('#teamName')?.value?.trim();
    if (!name) return toast('Team name required.');
    const row = { owner_id: user.id, name, game: $('#teamGame')?.value || 'Valorant', region: $('#teamRegion')?.value || '', rank_required: $('#teamRank')?.value || '', description: $('#teamDescription')?.value || '' };
    const { error } = await c.from('teams').insert(row);
    if (error) return toast('Create team failed: ' + error.message);
    closeModal('teamModal');
    $('#teamForm')?.reset();
    toast('Team created.');
    loadTeams();
  }
  async function loadTeams() {
    const c = getClient(); const el = $('#teamList'); if (!el) return;
    if (!c) { el.innerHTML = '<div class="empty-state">Connect Supabase to load teams.</div>'; return; }
    const { data } = await c.from('teams').select('*').order('created_at',{ascending:false}).limit(50);
    el.innerHTML = (data || []).map(t => `<article class="team-card"><span class="chip">${esc(t.game || 'Game')}</span><h3>${esc(t.name)}</h3><p>${esc(t.description || '')}</p><small>${esc(t.region || '')} ${t.rank_required ? '· '+esc(t.rank_required) : ''}</small><div class="actions"><button class="mini" onclick="toastStackOps('Joined ${esc(t.name)}')">Join</button>${user && t.owner_id===user.id ? `<button class="mini danger" onclick="deleteTeam('${t.id}')">Delete</button>`:''}</div></article>`).join('') || '<div class="empty-state">No real teams yet. Create one.</div>';
  }
  window.deleteTeam = async function(id){ const c=getClient(); const {error}=await c.from('teams').delete().eq('id',id); if(error)return toast(error.message); toast('Team deleted'); loadTeams(); };

  async function createPost() {
    if (needLogin()) return;
    const c = getClient();
    const content = $('#postContent')?.value?.trim();
    if (!content) return toast('Write something first.');
    const { error } = await c.from('posts').insert({ user_id: user.id, content });
    if (error) return toast('Post failed: ' + error.message);
    $('#postContent').value = '';
    toast('Post published.');
    loadPosts();
  }
  async function loadPosts() {
    const c = getClient(); const el = $('#postList'); if (!el) return;
    if (!c) { el.innerHTML = '<div class="empty-state">Connect Supabase to load posts.</div>'; return; }
    const { data } = await c.from('posts').select('*').order('created_at',{ascending:false}).limit(50);
    el.innerHTML = (data || []).map(p => `<article class="post-card"><p>${esc(p.content)}</p><small>${new Date(p.created_at || Date.now()).toLocaleString()}</small>${user && p.user_id===user.id ? `<div class="post-actions"><button class="mini danger" onclick="deletePost('${p.id}')">Delete</button></div>`:''}</article>`).join('') || '<div class="empty-state">No real posts yet. Be first.</div>';
  }
  window.deletePost = async function(id){ const c=getClient(); const {error}=await c.from('posts').delete().eq('id',id); if(error)return toast(error.message); toast('Post deleted'); loadPosts(); };

  async function applySeller() {
    if (needLogin()) return;
    if (isSeller()) return toast('You are already an approved seller.');
    const c = getClient();
    const row = { user_id:user.id, applicant_email:user.email, applicant_name:profile?.display_name || profile?.username || user.email, note:'Seller application from StackOps marketplace', status:'pending' };
    const { error } = await c.from('seller_applications').upsert(row, { onConflict:'user_id' });
    if (error) return toast('Seller application failed: ' + error.message);
    await c.from('profiles').update({ seller_status:'pending' }).eq('id', user.id);
    profile = { ...(profile || {}), seller_status:'pending' };
    updateUI();
    toast('Application submitted. Admin will review it.');
  }

  function renderPlans() {
    const el = $('#planList'); if (!el) return;
    const plans = [
      ['free','Free',0,'Basic access'], ['bronze','Bronze',199,'Starter premium identity'], ['silver','Silver',499,'More visibility'], ['gold','Gold',999,'Serious player badge'], ['diamond','Diamond',2499,'Elite profile boost'], ['legend','Legend',5999,'Premium legend status']
    ];
    el.innerHTML = plans.map(([key,name,price,desc]) => `<article class="plan-card"><span class="tag">${name}</span><h3>${name}</h3><p>${desc}</p><h2>${money(price)}</h2><button class="btn ${price ? 'primary' : 'dark'} full" onclick="buyPlan('${key}')">${price ? 'Buy Plan' : 'Use Free'}</button></article>`).join('');
  }
  window.buyPlan = function(planKey) {
    const planMap = { bronze:199, silver:499, gold:999, diamond:2499, legend:5999 };
    const amount = planMap[planKey];
    if (!amount) return toast('Free plan is already active.');
    openManualPayment({ item_type:'plan', item_name:`StackOps ${planKey} plan`, amount_inr:amount, plan_key:planKey });
  };
  window.openManualPayment = function(ctx) {
    if (needLogin()) return;
    payment = ctx || {};
    $('#manualPayTitle') && ($('#manualPayTitle').textContent = payment.item_name || payment.name || 'Complete Payment');
    $('#manualPayAmount') && ($('#manualPayAmount').textContent = money(payment.amount_inr || payment.amount || 0));
    $('#manualPayUPI') && ($('#manualPayUPI').textContent = UPI_ID);
    $('#manualPayQR') && ($('#manualPayQR').src = UPI_QR);
    if ($('#manualPayUTR')) $('#manualPayUTR').value = '';
    if ($('#manualPayProof')) $('#manualPayProof').value = '';
    openModal('manualPaymentModal');
  };
  window.orderSellerService = function(id,title,price,sellerId){ openManualPayment({ item_type:'service', item_name:title, amount_inr:Number(price||0), service_id:id, seller_id:sellerId }); };

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  }

  async function submitManualPayment() {
    if (needLogin()) return;
    const c = getClient();
    if (!c) return toast('Supabase is not connected.');

    const btn = $('#submitManualPayment');
    const oldText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

    try {
      const utr = $('#manualPayUTR')?.value?.trim();
      const file = $('#manualPayProof')?.files?.[0];
      if (!utr) return toast('Enter UTR / Reference number.');
      if (!file) return toast('Upload payment screenshot with reference number clearly visible.');

      const amount = Number(payment?.amount_inr || payment?.amount || 0);
      if (!amount || amount < 1) return toast('Payment amount missing. Please reopen the plan/service payment.');

      const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const filePath = `${user.id}/${Date.now()}_${safeName}`;
      let proof_url = filePath;
      let proof_data = null;

      // First try Supabase Storage. If it is blocked, fallback to DB proof_data so submit still works.
      const up = await c.storage.from('payment-proofs').upload(filePath, file, { upsert: true, contentType: file.type || 'image/png' });
      if (up.error) {
        console.warn('Storage upload blocked, using proof_data fallback:', up.error.message);
        try { proof_data = await readFileAsDataURL(file); } catch (_) { proof_data = null; }
        proof_url = null;
      }

      const com = commission(amount);
      const row = {
        buyer_id: user.id,
        seller_id: payment?.seller_id || null,
        service_id: payment?.service_id || null,
        item_type: payment?.item_type || 'plan',
        item_name: payment?.item_name || payment?.name || 'StackOps purchase',
        plan_key: payment?.plan_key || null,
        amount_inr: amount,
        commission_inr: com,
        seller_earning_inr: Math.max(0, amount - com),
        utr,
        proof_url,
        proof_data,
        proof_file_name: safeName,
        status: 'pending',
        is_feedback_public: !!$('#manualPayPublicFeedback')?.checked
      };

      const { error } = await c.from('manual_orders').insert(row);
      if (error) {
        console.error('manual_orders insert error', error);
        return toast('Payment submit failed: ' + error.message + '. Run FINAL_PAYMENT_NO_ERRORS_SQL.sql once.');
      }

      closeModal('manualPaymentModal');
      if ($('#manualPayUTR')) $('#manualPayUTR').value = '';
      if ($('#manualPayProof')) $('#manualPayProof').value = '';
      toast('Payment submitted. It will reflect in your account within 24–48 hours after verification.');
      switchView('account');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = oldText || 'Submit Payment Proof'; }
    }
  }

  async function createService() {
    if (needLogin()) return;
    if (!isSeller()) return toast('Seller approval required before creating services.');
    const c = getClient();
    const title = $('#serviceTitle')?.value?.trim();
    const price = Number($('#servicePrice')?.value || 0);
    if (!title || !price) return toast('Service title and price required.');
    const row = { seller_id:user.id, title, game:$('#serviceGame')?.value || 'Valorant', price_inr:price, description:$('#serviceDescription')?.value || '', status:'active' };
    const { error } = await c.from('seller_services').insert(row);
    if (error) return toast('Create service failed: ' + error.message);
    ['serviceTitle','serviceGame','servicePrice','serviceDescription'].forEach(id => { const el=$('#'+id); if(el) el.value=''; });
    toast('Service listing created.');
    loadSellerDashboard(); loadServices();
  }
  async function loadServices() {
    const c = getClient(); const el = $('#serviceList'); if (!el) return;
    if (!c) { el.innerHTML = '<div class="empty-state">Connect Supabase to load services.</div>'; return; }
    const { data } = await c.from('seller_services').select('*').eq('status','active').order('created_at',{ascending:false});
    el.innerHTML = (data || []).map(s => `<article class="service-card"><span class="chip">${esc(s.game || 'Gaming')}</span><h3>${esc(s.title)}</h3><p>${esc(s.description || '')}</p><div class="card-foot"><b>${money(s.price_inr)}</b><button class="btn primary" onclick="orderSellerService('${s.id}','${esc(s.title).replace(/'/g,'&#39;')}',${Number(s.price_inr||0)},'${s.seller_id||''}')">Buy</button></div></article>`).join('') || '<div class="empty-state">No real seller services yet. Approved sellers can upload services.</div>';
  }
  async function loadSellerDashboard() {
    const c = getClient(); if (!c || !user) return;
    if (!isSeller()) { const el=$('#sellerServiceList'); if(el) el.innerHTML='<div class="empty-state">Apply and get approved to create services.</div>'; updateUI(); return; }
    const { data: services } = await c.from('seller_services').select('*').eq('seller_id', user.id).order('created_at',{ascending:false});
    const el = $('#sellerServiceList');
    if (el) el.innerHTML = (services || []).map(s => `<div class="seller-row"><div><b>${esc(s.title)}</b><small>${esc(s.game||'')}</small></div><b>${money(s.price_inr)}</b><span>${esc(s.status)}</span></div>`).join('') || '<div class="empty-state">No services yet.</div>';
    const { data: orders } = await c.from('manual_orders').select('*').eq('seller_id', user.id).order('created_at',{ascending:false});
    const oe = $('#sellerOrderList'); if (oe) oe.innerHTML = (orders || []).map(o => `<div class="seller-row"><div><b>${esc(o.item_name)}</b><small>${esc(o.status)} · UTR ${esc(o.utr||'')}</small></div><b>${money(o.seller_earning_inr)}</b></div>`).join('') || '<div class="empty-state">No orders yet.</div>';
  }

  async function loadSellerApplications() {
    const c = getClient(); const el = $('#adminSellers') || $('#sellerReviewList'); if (!c || !el || !isAdmin()) return;
    const { data, error } = await c.from('seller_applications').select('*').order('created_at',{ascending:false});
    if (error) { el.innerHTML = '<div class="empty-state">Seller applications blocked: '+esc(error.message)+'</div>'; return; }
    el.innerHTML = (data || []).map(a => `<div class="user-row"><div><b>${esc(a.applicant_name || a.applicant_email || a.user_id)}</b><small>${esc(a.applicant_email || '')} · ${esc(a.status || 'pending')}</small></div><div>${a.status !== 'approved' ? `<button class="mini" onclick="approveSeller('${a.id}')">Approve</button>` : ''}${a.status !== 'rejected' ? `<button class="mini danger" onclick="rejectSeller('${a.id}')">Reject</button>` : ''}${a.status === 'approved' ? `<button class="mini danger" onclick="unapproveSeller('${a.id}')">Unapprove</button>` : ''}</div></div>`).join('') || '<div class="empty-state">No seller applications.</div>';
  }
  window.approveSeller = async function(id){ const c=getClient(); const {data:a}=await c.from('seller_applications').select('*').eq('id',id).maybeSingle(); if(!a)return toast('Application not found'); await c.from('seller_applications').update({status:'approved', reviewed_at:new Date().toISOString()}).eq('id',id); await c.from('profiles').update({is_seller:true, seller_status:'approved'}).eq('id',a.user_id); toast('Seller approved'); loadSellerApplications(); };
  window.rejectSeller = async function(id){ const c=getClient(); await c.from('seller_applications').update({status:'rejected', reviewed_at:new Date().toISOString()}).eq('id',id); toast('Seller rejected'); loadSellerApplications(); };
  window.unapproveSeller = async function(id){ const c=getClient(); const {data:a}=await c.from('seller_applications').select('*').eq('id',id).maybeSingle(); if(a) await c.from('profiles').update({is_seller:false, seller_status:'none'}).eq('id',a.user_id); await c.from('seller_applications').update({status:'pending'}).eq('id',id); toast('Seller moved to pending'); loadSellerApplications(); };

  function orderProofHTML(o) {
    if (o.proof_data) return `<img class="proof-thumb" src="${o.proof_data}" alt="Payment proof">`;
    if (o.proof_url) {
      let url = '#';
      try { url = getClient().storage.from('payment-proofs').getPublicUrl(o.proof_url).data.publicUrl; } catch (_) {}
      return `<a class="mini" href="${url}" target="_blank" rel="noopener">Open Proof</a>`;
    }
    return '<small>No proof uploaded</small>';
  }

  async function loadManualOrders() {
    const c = getClient(); const el = $('#adminManualOrders'); if (!c || !el || !isAdmin()) return;
    el.innerHTML = '<div class="empty-state">Loading payment orders...</div>';
    const { data, error } = await c.from('manual_orders').select('*').order('created_at',{ascending:false}).limit(80);
    if (error) { el.innerHTML = '<div class="empty-state">Orders blocked: '+esc(error.message)+'<br><small>Run FINAL_PAYMENT_NO_ERRORS_SQL.sql once.</small></div>'; return; }
    el.innerHTML = (data || []).map(o => `
      <div class="user-row payment-order-card">
        <div>
          <b>${esc(o.item_name || o.item_type || 'Manual order')}</b>
          <small>${money(o.amount_inr)} · ${esc(o.status || 'pending')} · UTR ${esc(o.utr||'')}</small>
          <small>Commission ${money(o.commission_inr)} · Seller payout ${money(o.seller_earning_inr)}</small>
          <div class="proof-box">${orderProofHTML(o)}</div>
        </div>
        <div>
          ${o.status !== 'approved' ? `<button class="mini" onclick="adminOrderStatus('${o.id}','approved')">Approve</button>` : `<button class="mini danger" onclick="adminOrderStatus('${o.id}','pending')">Unapprove</button>`}
          ${o.status !== 'rejected' ? `<button class="mini danger" onclick="adminOrderStatus('${o.id}','rejected')">Reject</button>` : ''}
        </div>
      </div>`).join('') || '<div class="empty-state">No manual orders yet.</div>';
  }
  window.adminOrderStatus = async function(id,status){
    const c=getClient();
    const { data: order } = await c.from('manual_orders').select('*').eq('id',id).maybeSingle();
    const {error}=await c.from('manual_orders').update({status, approved_at:status==='approved'?new Date().toISOString():null, rejected_at:status==='rejected'?new Date().toISOString():null}).eq('id',id);
    if(error)return toast(error.message);
    if (status === 'approved' && order?.buyer_id && order?.plan_key) {
      await c.from('profiles').update({ plan_key: order.plan_key, is_verified: true }).eq('id', order.buyer_id);
    }
    toast('Order '+status);
    loadManualOrders();
  };
  async function loadPayouts() { /* safe placeholder */ }

  async function sendMessage() {
    if (needLogin()) return;
    const text = $('#messageInput')?.value?.trim();
    if (!text) return;
    const c = getClient();
    const { error } = await c.from('messages').insert({ user_id:user.id, channel:'global', content:text });
    if (error) return toast('Message failed: '+error.message);
    $('#messageInput').value = '';
    toast('Message sent.');
  }

  function wire() {
    $('#boot')?.classList.add('hide'); setTimeout(() => $('#boot')?.remove(), 900);
    $$('.nav').forEach(btn => btn.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); switchView(btn.dataset.view); }, true));
    bindClick('openAuth', () => user ? logout() : openModal('authModal'));
    bindClick('closeAuth', () => closeModal('authModal'));
    $$('[data-close]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); closeModal(b.dataset.close); }, true));
    bindClick('loginBtn', login); bindClick('signupBtn', signup);
    bindClick('saveLanguage', () => closeModal('languageModal'));
    bindClick('hamb', () => $('#mobileMenu')?.classList.toggle('open'));
    bindClick('themeToggle', () => document.body.classList.toggle('light'));
    bindSubmit('profileForm', saveProfile);
    bindClick('newTeamBtn', () => needLogin() ? null : openModal('teamModal'));
    bindSubmit('teamForm', createTeam);
    bindClick('quickMatchBtn', () => { switchView('chat'); toast('Quick match chat opened.'); });
    bindClick('createPostBtn', createPost);
    bindClick('sendMsgBtn', sendMessage);
    $('#messageInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } });
    bindClick('applySellerBtn', applySeller);
    bindClick('createServiceBtn', createService);
    bindClick('requestPayoutBtn', () => toast('Payout request will be enabled after approved completed orders.'));
    bindClick('refreshSellerDashboard', loadSellerDashboard);
    bindClick('refreshAdminOrders', () => { loadManualOrders(); loadSellerApplications(); });
    bindClick('submitManualPayment', submitManualPayment);
    bindClick('closeManualPay', () => closeModal('manualPaymentModal'));
    bindClick('copyManualUPI', async () => { try { await navigator.clipboard.writeText(UPI_ID); } catch(e) {} toast('UPI copied.'); });
    bindClick('scrollTop', () => window.scrollTo({ top: 0, behavior:'smooth' }));
    window.addEventListener('scroll', () => $('#scrollTop')?.classList.toggle('show', scrollY > 420));
  }
  window.toastStackOps = toast;
  window.addEventListener('error', (e) => { console.error('StackOps JS error:', e.error || e.message); $('#boot')?.remove(); });
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      wire();
      renderPlans();
      await loadSession();
      loadTeams(); loadPosts(); loadServices(); loadSellerDashboard();
      if (getClient()) getClient().auth.onAuthStateChange(async (_event, session) => { user = session?.user || null; if (user) await loadProfile(); else profile = null; updateUI(); });
    } catch (e) {
      console.error('StackOps final init failed', e);
      $('#boot')?.remove();
      toast('Loaded with safe mode.');
    }
  });
})();
