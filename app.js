const CONFIG = window.STACKOPS_CONFIG || {};

const intro = document.getElementById("intro");
const app = document.getElementById("app");
const guestActions = document.getElementById("guestActions");
const userActions = document.getElementById("userActions");
const guestView = document.getElementById("guestView");
const userView = document.getElementById("userView");
const profileBtn = document.getElementById("profileBtn");

let supabase = null;

// Intro must never depend on Supabase
function finishIntro() {
  if (intro) {
    intro.classList.add("hide");
    setTimeout(() => {
      if (intro.parentNode) intro.parentNode.removeChild(intro);
      if (app) app.classList.remove("hidden");
    }, 500);
  } else if (app) {
    app.classList.remove("hidden");
  }
}

// Start intro fallback immediately
setTimeout(finishIntro, 1600);
setTimeout(finishIntro, 3200);

// Supabase init safely
try {
  if (
    window.supabase &&
    CONFIG.supabaseUrl &&
    CONFIG.supabaseAnonKey &&
    !String(CONFIG.supabaseUrl).includes("YOUR_PROJECT") &&
    !String(CONFIG.supabaseAnonKey).includes("PASTE_")
  ) {
    supabase = window.supabase.createClient(
      CONFIG.supabaseUrl,
      CONFIG.supabaseAnonKey
    );
  }
} catch (err) {
  console.error("Supabase init failed:", err);
}

function setGuestMode() {
  if (guestActions) guestActions.classList.remove("hidden");
  if (guestView) guestView.classList.remove("hidden");
  if (userActions) userActions.classList.add("hidden");
  if (userView) userView.classList.add("hidden");
}

function setUserMode(email) {
  if (guestActions) guestActions.classList.add("hidden");
  if (guestView) guestView.classList.add("hidden");
  if (userActions) userActions.classList.remove("hidden");
  if (userView) userView.classList.remove("hidden");
  if (profileBtn && email) profileBtn.textContent = email;
}

async function refreshAuthState() {
  if (!supabase) {
    setGuestMode();
    return;
  }

  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (session?.user) setUserMode(session.user.email || "My profile");
    else setGuestMode();
  } catch (err) {
    console.error(err);
    setGuestMode();
  }
}

const authModal = document.getElementById("authModal");
const detailModal = document.getElementById("detailModal");
const reportModal = document.getElementById("reportModal");

function openAuth(mode = "signin") {
  const title = document.getElementById("authTitle");
  if (title) title.textContent = mode === "signup" ? "Create account" : "Sign in";
  if (authModal) authModal.classList.remove("hidden");
}

function closeAuth() {
  if (authModal) authModal.classList.add("hidden");
}

document.querySelectorAll("[data-auth-open]").forEach((btn) => {
  btn.addEventListener("click", () => openAuth(btn.dataset.authOpen));
});

const closeAuthBtn = document.getElementById("closeAuthBtn");
const closeAuthBtn2 = document.getElementById("closeAuthBtn2");
if (closeAuthBtn) closeAuthBtn.onclick = closeAuth;
if (closeAuthBtn2) closeAuthBtn2.onclick = closeAuth;

const emailBtn = document.getElementById("emailBtn");
if (emailBtn) {
  emailBtn.onclick = () => {
    alert("Add your email/password logic later. Intro and UI now work independently.");
  };
}

const googleBtn = document.getElementById("googleBtn");
if (googleBtn) {
  googleBtn.onclick = async () => {
    if (!CONFIG.googleEnabled) {
      alert("Google login disabled in config.js");
      return;
    }
    if (!supabase) {
      alert("Supabase not initialized");
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    });
    if (error) alert(error.message);
  };
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.onclick = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error(err);
      }
    }
    setGuestMode();
  };
}

document.querySelectorAll(".detail-trigger").forEach((btn) => {
  btn.addEventListener("click", () => {
    const type = document.getElementById("detailType");
    const title = document.getElementById("detailTitle");
    const meta = document.getElementById("detailMeta");
    if (type) type.textContent = (btn.dataset.type || "DETAIL").toUpperCase();
    if (title) title.textContent = btn.dataset.title || "Item";
    if (meta) meta.textContent = btn.dataset.meta || "";
    if (detailModal) detailModal.classList.remove("hidden");
  });
});

const closeDetailBtn = document.getElementById("closeDetailBtn");
const detailCloseBtn = document.getElementById("detailCloseBtn");
if (closeDetailBtn) closeDetailBtn.onclick = () => detailModal && detailModal.classList.add("hidden");
if (detailCloseBtn) detailCloseBtn.onclick = () => detailModal && detailModal.classList.add("hidden");

let currentReport = { targetType: "", targetId: "", reason: "" };

document.querySelectorAll(".report-trigger").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentReport.targetType = btn.dataset.targetType || "";
    currentReport.targetId = btn.dataset.targetId || "";
    currentReport.reason = "";
    const details = document.getElementById("reportDetails");
    const status = document.getElementById("reportStatus");
    if (details) details.value = "";
    if (status) status.textContent = "Choose a reason and submit report.";
    if (reportModal) reportModal.classList.remove("hidden");
  });
});

document.querySelectorAll(".preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentReport.reason = btn.dataset.reason || "";
    const status = document.getElementById("reportStatus");
    if (status) status.textContent = `Selected: ${currentReport.reason}`;
  });
});

function closeReport() {
  if (reportModal) reportModal.classList.add("hidden");
}

const closeReportBtn = document.getElementById("closeReportBtn");
const closeReportBtn2 = document.getElementById("closeReportBtn2");
if (closeReportBtn) closeReportBtn.onclick = closeReport;
if (closeReportBtn2) closeReportBtn2.onclick = closeReport;

const submitReportBtn = document.getElementById("submitReportBtn");
if (submitReportBtn) {
  submitReportBtn.onclick = () => {
    const details = document.getElementById("reportDetails")?.value || "";
    const payload = {
      targetType: currentReport.targetType,
      targetId: currentReport.targetId,
      reason: currentReport.reason || "Other",
      details
    };
    const existing = JSON.parse(localStorage.getItem("stackops_reports") || "[]");
    existing.push(payload);
    localStorage.setItem("stackops_reports", JSON.stringify(existing));
    const status = document.getElementById("reportStatus");
    if (status) status.textContent = "Report submitted successfully.";
    setTimeout(closeReport, 700);
  };
}

refreshAuthState();

if (supabase) {
  supabase.auth.onAuthStateChange(async () => {
    await refreshAuthState();
    closeAuth();
  });
}