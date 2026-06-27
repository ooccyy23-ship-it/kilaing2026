import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  initializeAppCheck,
  ReCaptchaV3Provider
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app-check.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  collection,
  getDocs,
  getFirestore,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getDownloadURL, getStorage, ref } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
if (firebaseConfig.appCheckSiteKey && firebaseConfig.appCheckSiteKey !== "PASTE_RECAPTCHA_V3_SITE_KEY") {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(firebaseConfig.appCheckSiteKey),
    isTokenAutoRefreshEnabled: true
  });
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const loginForm = document.querySelector("#adminLoginForm");
const loginStatus = document.querySelector("#loginStatus");
const adminPanel = document.querySelector("#adminPanel");
const rowsEl = document.querySelector("#registrationRows");
const refreshButton = document.querySelector("#refreshButton");
const downloadButton = document.querySelector("#downloadCsvButton");
const logoutButton = document.querySelector("#logoutButton");
const adminEmail = document.querySelector("#adminEmail");
const searchInput = document.querySelector("#searchInput");
const transportFilter = document.querySelector("#transportFilter");
const summaryEl = document.querySelector("#adminSummary");

let registrations = [];

onAuthStateChanged(auth, async (user) => {
  const loggedIn = Boolean(user);
  if (loginForm) loginForm.hidden = loggedIn;
  if (adminPanel) adminPanel.hidden = !loggedIn;
  if (adminEmail) adminEmail.textContent = user?.email || "";

  if (loggedIn) {
    await loadRegistrations();
  } else {
    registrations = [];
    renderRows([]);
    renderSummary([]);
  }
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(loginStatus, "登入中...", "");

  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  try {
    await signInWithEmailAndPassword(auth, email, password);
    setStatus(loginStatus, "", "");
    loginForm.reset();
  } catch (error) {
    setStatus(loginStatus, getLoginErrorMessage(error), "error");
  }
});

logoutButton?.addEventListener("click", async () => {
  await signOut(auth);
});
refreshButton?.addEventListener("click", loadRegistrations);
downloadButton?.addEventListener("click", downloadCsv);
searchInput?.addEventListener("input", renderFilteredRows);
transportFilter?.addEventListener("change", renderFilteredRows);

async function loadRegistrations() {
  renderLoading();

  try {
    const registrationsQuery = query(collection(db, "registrations"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(registrationsQuery);
    registrations = snapshot.docs.map((item) => ({
      firebaseId: item.id,
      ...item.data()
    }));
    renderFilteredRows();
  } catch (error) {
    renderMessage(getDataErrorMessage(error));
  }
}

function renderFilteredRows() {
  const filtered = applyFilters(registrations);
  renderRows(filtered);
  renderSummary(filtered);
}

function applyFilters(items) {
  const term = String(searchInput?.value || "").trim().toLowerCase();
  const transportValue = String(transportFilter?.value || "");

  return items.filter((item) => {
    const matchesSearch =
      !term ||
      [item.name, item.email, item.phone, item.church, item.nationalId, item.campType]
        .join(" ")
        .toLowerCase()
        .includes(term);
    const matchesTransport = !transportValue || item.transport === transportValue;
    return matchesSearch && matchesTransport;
  });
}

function renderSummary(items) {
  if (!summaryEl) return;
  const under18 = items.filter((item) => item.isUnder18).length;
  summaryEl.textContent = `目前共 ${items.length} 筆，未滿 18 歲 ${under18} 筆。`;
}

function renderRows(items) {
  if (!rowsEl) return;
  rowsEl.replaceChildren();

  if (!items.length) {
    rowsEl.appendChild(createMessageRow("目前沒有資料。"));
    return;
  }

  for (const item of items) {
    rowsEl.appendChild(createRow(item));
  }
}

function renderLoading() {
  if (!rowsEl) return;
  rowsEl.replaceChildren(createMessageRow("載入中..."));
}

function renderMessage(message) {
  if (!rowsEl) return;
  rowsEl.replaceChildren(createMessageRow(message));
  renderSummary([]);
}

function createMessageRow(message) {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 12;
  td.textContent = message;
  tr.appendChild(td);
  return tr;
}

function createRow(item) {
  const tr = document.createElement("tr");
  tr.appendChild(cell(formatDate(item.createdAt)));
  tr.appendChild(cell(item.name));
  tr.appendChild(cell(item.campType));
  tr.appendChild(cell(item.gender));
  tr.appendChild(cell(item.phone));
  tr.appendChild(cell(item.email));
  tr.appendChild(cell(item.church));
  tr.appendChild(cell(item.shirtSize));
  tr.appendChild(cell(item.transport));
  tr.appendChild(cell(item.isUnder18 ? "是" : "否"));
  tr.appendChild(cell(formatDiet(item)));
  tr.appendChild(consentCell(item));
  return tr;
}

function formatDiet(item) {
  if (item.diet === "其他" && item.dietOther) {
    return `其他：${item.dietOther}`;
  }
  return item.diet || "";
}

function consentCell(item) {
  const td = document.createElement("td");
  if (!item.consentStoragePath) {
    td.textContent = "免上傳";
    return td;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "button secondary admin-inline-button";
  button.textContent = "下載";
  button.addEventListener("click", async () => {
    button.disabled = true;
    const original = button.textContent;
    button.textContent = "載入中...";
    try {
      const url = await getDownloadURL(ref(storage, item.consentStoragePath));
      window.open(url, "_blank", "noreferrer");
    } catch (error) {
      alert(getDataErrorMessage(error));
    } finally {
      button.textContent = original;
      button.disabled = false;
    }
  });
  td.appendChild(button);
  return td;
}

function cell(text) {
  const td = document.createElement("td");
  td.textContent = text ?? "";
  return td;
}

function downloadCsv() {
  const headers = [
    "報名編號",
    "報名時間",
    "姓名",
    "營別",
    "性別",
    "電話",
    "Email",
    "教會名稱",
    "地址",
    "衣服尺寸",
    "接送需求",
    "飲食",
    "飲食說明",
    "未滿18",
    "身分證字號",
    "生日",
    "家長同意書"
  ];

  const rows = applyFilters(registrations).map((item) => [
    item.registrationId,
    formatDate(item.createdAt),
    item.name,
    item.campType,
    item.gender,
    item.phone,
    item.email,
    item.church,
    item.address,
    item.shirtSize,
    item.transport,
    item.diet,
    item.dietOther || "",
    item.isUnder18 ? "是" : "否",
    item.nationalId,
    item.birthday,
    item.consentOriginalName || ""
  ]);

  const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "youth-leadership-camp-registrations.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function formatDate(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function setStatus(element, message, kind) {
  if (!element) return;
  element.textContent = message;
  element.className = kind ? `form-status ${kind}` : "form-status";
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

function getDataErrorMessage(error) {
  const code = String(error?.code || "");
  if (code.includes("permission-denied")) {
    return "權限不足，請確認 Firestore 或 Storage 規則。";
  }
  return error?.message || "發生未預期的錯誤。";
}
