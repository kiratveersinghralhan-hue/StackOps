const CONFIG = window.STACKOPS_CONFIG || {};

const intro = document.getElementById("intro");
const app = document.getElementById("app");
const guestActions = document.getElementById("guestActions");
const userActions = document.getElementById("userActions");
const guestView = document.getElementById("guestView");
const userView = document.getElementById("userView");
const profileBtn = document.getElementById("profileBtn");

let supabase = null;
if (CONFIG.supabaseUrl && CONFIG.supabaseAnonKey) {
  supabase = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
}

function finishIntro() {
  if (intro) {
    intro.classList.add("hide");
    setTimeout(() => {
      if (intro.parentNode) intro.parentNode.removeChild(intro);
      app.classList.remove("hidden");
    }, 500);
  } else {
    app.classList.remove("hidden");
  }
}

setTimeout(finishIntro, 1600);
setTimeout(finishIntro, 3200);

function setGuestMode() {
  guestActions.classList.remove("hidden");
  guestView.classList.remove("hidden");
  userActions.classList.add("hidden");
  userView.classList.add("hidden");
}

function setUserMode(email) {
  guestActions.classList.add("hidden");
  guestView.classList.add("hidden");
  userActions.classList.remove("hidden");
  userView.classList.remove("hidden");
  if (email) profileBtn.textContent = email;
}

async function refreshAuthState() {
  if (!supabase) {
    setGuestMode();
    return;
  }
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (session?.user) setUserMode(session.user.email || "My profile");
  else setGuestMode();
}

const authModal = document.getElementById("authModal");
const detailModal = document.getElementById("detailModal");
const reportModal = document.getElementById("reportModal");

function openAuth(mode = "signin") {
  document.getElementById("authTitle").textContent = mode === "signup" ? "Create account" : "Sign in";
  authModal.classList.remove("hidden");
}
function closeAuth() { authModal.classList.add("hidden"); }

document.querySelectorAll("[data-auth-open]").forEach(btn => {
  btn.addEventListener("click", () => openAuth(btn.dataset.authOpen));
});
document.getElementById("closeAuthBtn").onclick = closeAuth;
document.getElementById("closeAuthBtn2").onclick = closeAuth;

document.getElementById("emailBtn").onclick = () => {
  alert("Add your earlier email/password logic here if you want. This pack is focused on restoring the earlier working UI and fixing Google login.");
};

document.getElementById("googleBtn").onclick = async () => {
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

async function logout() {
  if (supabase) await supabase.auth.signOut();
  setGuestMode();
}
document.getElementById("logoutBtn").onclick = logout;

document.querySelectorAll(".detail-trigger").forEach(btn => {
  btn.addEventListener("click", () => {
    document.getElementById("detailType").textContent = (btn.dataset.type || "DETAIL").toUpperCase();
    document.getElementById("detailTitle").textContent = btn.dataset.title || "Item";
    document.getElementById("detailMeta").textContent = btn.dataset.meta || "";
    detailModal.classList.remove("hidden");
  });
});
document.getElementById("closeDetailBtn").onclick = () => detailModal.classList.add("hidden");
document.getElementById("detailCloseBtn").onclick = () => detailModal.classList.add("hidden");

let currentReport = { targetType: "", targetId: "", reason: "" };

document.querySelectorAll(".report-trigger").forEach(btn => {
  btn.addEventListener("click", () => {
    currentReport.targetType = btn.dataset.targetType || "";
    currentReport.targetId = btn.dataset.targetId || "";
    currentReport.reason = "";
    document.getElementById("reportDetails").value = "";
    document.getElementById("reportStatus").textContent = "Choose a reason and submit report.";
    reportModal.classList.remove("hidden");
  });
});

document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    currentReport.reason = btn.dataset.reason || "";
    document.getElementById("reportStatus").textContent = `Selected: ${currentReport.reason}`;
  });
});

function closeReport() { reportModal.classList.add("hidden"); }
document.getElementById("closeReportBtn").onclick = closeReport;
document.getElementById("closeReportBtn2").onclick = closeReport;

document.getElementById("submitReportBtn").onclick = () => {
  const details = document.getElementById("reportDetails").value || "";
  const payload = {
    targetType: currentReport.targetType,
    targetId: currentReport.targetId,
    reason: currentReport.reason || "Other",
    details
  };
  const existing = JSON.parse(localStorage.getItem("stackops_reports") || "[]");
  existing.push(payload);
  localStorage.setItem("stackops_reports", JSON.stringify(existing));
  document.getElementById("reportStatus").textContent = "Report submitted successfully.";
  setTimeout(closeReport, 700);
};

refreshAuthState();
if (supabase) {
  supabase.auth.onAuthStateChange(async () => {
    await refreshAuthState();
    closeAuth();
  });
}
