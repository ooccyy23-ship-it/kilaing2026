// ============================
// admin-auth.js
// 登入頁邏輯：Firebase Auth 登入、已登入自動跳轉
// ============================

import { auth } from "../js/firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

// 已登入 → 直接跳轉後台
onAuthStateChanged(auth, user => {
  if (user) window.location.href = "./dashboard.html";
});

// DOM refs
const loginForm     = document.getElementById('loginForm');
const loginBtn      = document.getElementById('loginBtn');
const loginText     = loginBtn.querySelector('.login-text');
const loginLoading  = loginBtn.querySelector('.login-loading');
const errLogin      = document.getElementById('err-login');
const pwToggle      = document.getElementById('pwToggle');
const pwInput       = document.getElementById('loginPassword');

// 顯示 / 隱藏密碼
pwToggle.addEventListener('click', () => {
  const isText = pwInput.type === 'text';
  pwInput.type = isText ? 'password' : 'text';
  pwToggle.textContent = isText ? '👁' : '🙈';
});

// 登入送出
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  errLogin.textContent = '';

  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    errLogin.textContent = '請填寫 Email 與密碼';
    return;
  }

  loginBtn.disabled   = true;
  loginText.hidden    = true;
  loginLoading.hidden = false;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged 會自動跳轉
  } catch (err) {
    loginBtn.disabled   = false;
    loginText.hidden    = false;
    loginLoading.hidden = true;

    switch (err.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        errLogin.textContent = 'Email 或密碼錯誤，請重新輸入';
        break;
      case 'auth/too-many-requests':
        errLogin.textContent = '登入嘗試過多，請稍後再試';
        break;
      default:
        errLogin.textContent = `登入失敗：${err.message}`;
    }
  }
});
