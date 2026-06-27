import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  initializeAppCheck,
  ReCaptchaV3Provider
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app-check.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
if (firebaseConfig.appCheckSiteKey && firebaseConfig.appCheckSiteKey !== "PASTE_RECAPTCHA_V3_SITE_KEY") {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(firebaseConfig.appCheckSiteKey),
    isTokenAutoRefreshEnabled: true
  });
}

const auth = getAuth(app);
const loginForm = document.querySelector("#adminLoginForm");
const loginStatus = document.querySelector("#loginStatus");

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "./dashboard.html";
  }
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("登入中...", "");

  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginForm.reset();
    setStatus("", "");
  } catch (error) {
    setStatus(getLoginErrorMessage(error), "error");
  }
});

function setStatus(message, kind) {
  if (!loginStatus) return;
  loginStatus.textContent = message;
  loginStatus.className = kind ? `form-status ${kind}` : "form-status";
}

function getLoginErrorMessage(error) {
  const code = String(error?.code || "");
  if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password")) {
    return "登入失敗，請確認 Email 與密碼是否正確。";
  }
  if (code.includes("auth/user-not-found")) {
    return "找不到這個帳號，請確認是否輸入正確的管理員 Email。";
  }
  if (code.includes("auth/unauthorized-domain")) {
    return "登入失敗，請先把網域加入 Firebase Authentication 授權網域。";
  }
  if (code.includes("auth/too-many-requests")) {
    return "嘗試次數太多，請稍後再試。";
  }
  return `登入失敗：${error?.message || "請稍後再試。"}`;
}
