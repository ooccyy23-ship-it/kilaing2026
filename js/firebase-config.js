// ============================
// firebase-config.js
// Firebase 初始化 — 所有頁面共用此模組
// ============================

import { initializeApp }      from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore }       from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage }         from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { getAuth }            from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getAnalytics }       from "https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDsFzfF7yb8bJk9ZpuonaGQWtx0EfxNxyU",
  authDomain:        "valleyball2026-8c89e.firebaseapp.com",
  projectId:         "valleyball2026-8c89e",
  storageBucket:     "valleyball2026-8c89e.firebasestorage.app",
  messagingSenderId: "1003367903035",
  appId:             "1:1003367903035:web:de8934ba4634d9271cd11e",
  measurementId:     "G-PXT3QFNXFK"
};

const app       = initializeApp(firebaseConfig);
const db        = getFirestore(app);
const storage   = getStorage(app);
const auth      = getAuth(app);
const analytics = getAnalytics(app);

export { app, db, storage, auth, analytics };
