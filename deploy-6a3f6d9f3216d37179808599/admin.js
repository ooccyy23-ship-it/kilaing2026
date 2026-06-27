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
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

// ── Firebase init ──────────────────────────────────
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

// ── DOM refs ───────────────────────────────────────
const loginScreen = qs("#loginScreen");
const adminShell = qs("#adminShell");
const loginForm = qs("#adminLoginForm");
const loginStatus = qs("#loginStatus");
const logoutButton = qs("#logoutButton");
const adminEmailEl = qs("#adminEmail");
const userAvatarEl = qs("#userAvatar");
const refreshButton = qs("#refreshButton");
const downloadButton = qs("#downloadCsvButton");
const rowsEl = qs("#registrationRows");
const totalBadge = qs("#totalBadge");
const filterSummary = qs("#filterSummary");

const searchInput = qs("#searchInput");
const transportFilter = qs("#transportFilter");
const clearFiltersBtn = qs("#clearFilters");

const statTotal = qs("#statTotal");
const statUnder18 = qs("#statUnder18");
const statTransport = qs("#statTransport");
const statVeg = qs("#statVeg");

// Edit modal
const editModal = qs("#editModal");
const editForm = qs("#editForm");
const editFirebaseId = qs("#editFirebaseId");
const editName = qs("#editName");
const editGender = qs("#editGender");
const editPhone = qs("#editPhone");
const editEmail = qs("#editEmail");
const editChurch = qs("#editChurch");
const editAddress = qs("#editAddress");
const editShirtSize = qs("#editShirtSize");
const editTransport = qs("#editTransport");
const editDiet = qs("#editDiet");
const editDietOther = qs("#editDietOther");
const editDietOtherWrap = qs("#editDietOtherWrap");
const editStatus = qs("#editStatus");
const editModalClose = qs("#editModalClose");
const editModalCancel = qs("#editModalCancel");
const editModalSave = qs("#editModalSave");

// Delete modal
const deleteModal = qs("#deleteModal");
const deleteTargetName = qs("#deleteTargetName");
const deleteStatus = qs("#deleteStatus");
const deleteModalClose = qs("#deleteModalClose");
const deleteModalCancel = qs("#deleteModalCancel");
const deleteModalConfirm = qs("#deleteModalConfirm");

// ── State ─────────────────────────────────────────
let registrations = [];
let pendingDeleteItem = null;

// ── Auth ──────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  const loggedIn = Boolean(user);
  loginScreen.hidden = loggedIn;
  adminShell.hidden = !loggedIn;

  if (loggedIn) {
    const email = user.email || "";
    adminEmailEl.textContent = email;
    userAvatarEl.textContent = email[0]?.toUpperCase() || "A";
    await loadRegistrations();
  } else {
    registrations = [];
    renderRows([]);
    updateStats([]);
  }
});

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg(loginStatus, "登入中…", "");
  const fd = new FormData(loginForm);
  try {
    await signInWithEmailAndPassword(
      auth,
      fd.get("email").trim(),
      fd.get("password")
    );
    loginForm.reset();
    setMsg(loginStatus, "", "");
  } catch (err) {
    setMsg(loginStatus, getLoginError(err), "error");
  }
});

logoutButton?.addEventListener("click", () => signOut(auth));

// ── Load ──────────────────────────────────────────
async function loadRegistrations() {
  rowsEl.innerHTML = `<tr><td colspan="12" class="table-msg">載入中…</td></tr>`;
  try {
    const snap = await getDocs(
      query(collection(db, "registrations"), orderBy("createdAt", "desc"))
    );
    registrations = snap.docs.map((d) => ({ firebaseId: d.id, ...d.data() }));
    renderFilteredRows();
  } catch (err) {
    rowsEl.innerHTML = `<tr><td colspan="12" class="table-msg">${getDataError(err)}</td></tr>`;
  }
}

refreshButton?.addEventListener("click", loadRegistrations);
downloadButton?.addEventListener("click", downloadCsv);

// ── Filters ───────────────────────────────────────
[searchInput, transportFilter].forEach((el) =>
  el?.addEventListener(el.tagName === "INPUT" ? "input" : "change", renderFilteredRows)
);

clearFiltersBtn?.addEventListener("click", () => {
  searchInput.value = "";
  transportFilter.value = "";
  renderFilteredRows();
});

function applyFilters(items) {
  const term = searchInput?.value.trim().toLowerCase() || "";
  const transport = transportFilter?.value || "";

  return items.filter((item) => {
    if (term && ![item.name, item.email, item.phone, item.church, item.nationalId]
      .join(" ").toLowerCase().includes(term)) return false;
    if (transport && item.transport !== transport) return false;
    return true;
  });
}

function renderFilteredRows() {
  const filtered = applyFilters(registrations);
  renderRows(filtered);
  updateStats(filtered);

  const hasFilter = [searchInput, transportFilter].some((el) => el?.value);
  filterSummary.textContent = hasFilter
    ? `篩選結果：${filtered.length} 筆（共 ${registrations.length} 筆）`
    : `共 ${registrations.length} 筆報名資料`;
  totalBadge.textContent = filtered.length;
}

// ── Stats ─────────────────────────────────────────
function updateStats(items) {
  statTotal.textContent = registrations.length;
  statUnder18.textContent = items.filter((i) => i.isUnder18).length;
  statTransport.textContent = items.filter((i) => i.transport === "需接送").length;
  statVeg.textContent = items.filter((i) => i.diet === "素食").length;
}

// ── Render rows ───────────────────────────────────
function renderRows(items) {
  if (!items.length) {
    rowsEl.innerHTML = `<tr><td colspan="12" class="table-msg">沒有符合條件的資料</td></tr>`;
    return;
  }
  rowsEl.replaceChildren(...items.map(createRow));
}

function createRow(item) {
  const tr = document.createElement("tr");

  const cells = [
    fmtDate(item.createdAt),
    item.name,
    item.gender,
    item.phone,
    item.email,
    item.church,
    item.shirtSize,
    item.transport,
    item.isUnder18 ? "是" : "否",
    item.diet === "其他" ? `其他：${item.dietOther || ""}` : item.diet
  ];

  cells.forEach((text) => {
    const td = document.createElement("td");
    td.textContent = text ?? "";
    tr.appendChild(td);
  });

  // Consent cell
  const consentTd = document.createElement("td");
  if (item.consentStoragePath) {
    const btn = document.createElement("button");
    btn.className = "btn btn-ghost btn-sm";
    btn.textContent = "下載";
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "…";
      try {
        const url = await getDownloadURL(ref(storage, item.consentStoragePath));
        window.open(url, "_blank", "noreferrer");
      } catch (e) {
        alert(getDataError(e));
      } finally {
        btn.textContent = "下載";
        btn.disabled = false;
      }
    });
    consentTd.appendChild(btn);
  } else {
    consentTd.innerHTML = `<span class="consent-na">免上傳</span>`;
  }
  tr.appendChild(consentTd);

  // Actions cell
  const actionTd = document.createElement("td");
  actionTd.className = "row-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "btn btn-icon btn-sm";
  editBtn.title = "編輯";
  editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  editBtn.addEventListener("click", () => openEditModal(item));

  const delBtn = document.createElement("button");
  delBtn.className = "btn btn-icon btn-sm";
  delBtn.title = "刪除";
  delBtn.style.color = "#c0392b";
  delBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
  delBtn.addEventListener("click", () => openDeleteModal(item));

  actionTd.appendChild(editBtn);
  actionTd.appendChild(delBtn);
  tr.appendChild(actionTd);

  return tr;
}

// ── Edit modal ────────────────────────────────────
function openEditModal(item) {
  editFirebaseId.value = item.firebaseId;
  editName.value = item.name || "";
  editGender.value = item.gender || "";
  editPhone.value = item.phone || "";
  editEmail.value = item.email || "";
  editChurch.value = item.church || "";
  editAddress.value = item.address || "";
  editShirtSize.value = item.shirtSize || "";
  editTransport.value = item.transport || "";
  editDiet.value = item.diet || "";
  editDietOther.value = item.dietOther || "";
  toggleDietOther();
  setMsg(editStatus, "", "");
  editModal.hidden = false;
}

function closeEditModal() { editModal.hidden = true; }

editModalClose?.addEventListener("click", closeEditModal);
editModalCancel?.addEventListener("click", closeEditModal);

editDiet?.addEventListener("change", toggleDietOther);

function toggleDietOther() {
  editDietOtherWrap.hidden = editDiet.value !== "其他";
}

editModalSave?.addEventListener("click", async () => {
  const id = editFirebaseId.value;
  if (!id) return;

  editModalSave.disabled = true;
  setMsg(editStatus, "儲存中…", "");

  const updates = {
    name: editName.value.trim(),
    gender: editGender.value,
    phone: editPhone.value.trim(),
    email: editEmail.value.trim(),
    church: editChurch.value.trim(),
    address: editAddress.value.trim(),
    shirtSize: editShirtSize.value,
    transport: editTransport.value,
    diet: editDiet.value,
    dietOther: editDiet.value === "其他" ? editDietOther.value.trim() : ""
  };

  try {
    await updateDoc(doc(db, "registrations", id), updates);

    // Update local state
    const idx = registrations.findIndex((r) => r.firebaseId === id);
    if (idx !== -1) registrations[idx] = { ...registrations[idx], ...updates };

    renderFilteredRows();
    setMsg(editStatus, "已儲存", "success");
    setTimeout(closeEditModal, 800);
  } catch (err) {
    setMsg(editStatus, getDataError(err), "error");
  } finally {
    editModalSave.disabled = false;
  }
});

// Close on backdrop click
editModal?.addEventListener("click", (e) => { if (e.target === editModal) closeEditModal(); });

// ── Delete modal ──────────────────────────────────
function openDeleteModal(item) {
  pendingDeleteItem = item;
  deleteTargetName.textContent = item.name || "（未知）";
  setMsg(deleteStatus, "", "");
  deleteModalConfirm.disabled = false;
  deleteModal.hidden = false;
}

function closeDeleteModal() {
  deleteModal.hidden = true;
  pendingDeleteItem = null;
}

deleteModalClose?.addEventListener("click", closeDeleteModal);
deleteModalCancel?.addEventListener("click", closeDeleteModal);
deleteModal?.addEventListener("click", (e) => { if (e.target === deleteModal) closeDeleteModal(); });

deleteModalConfirm?.addEventListener("click", async () => {
  if (!pendingDeleteItem) return;
  const item = pendingDeleteItem;

  deleteModalConfirm.disabled = true;
  setMsg(deleteStatus, "刪除中…", "");

  try {
    // Delete consent file from Storage if exists
    if (item.consentStoragePath) {
      try {
        await deleteObject(ref(storage, item.consentStoragePath));
      } catch (storageErr) {
        // Non-fatal: file may already be gone
        console.warn("Storage delete skipped:", storageErr.code);
      }
    }

    await deleteDoc(doc(db, "registrations", item.firebaseId));
    registrations = registrations.filter((r) => r.firebaseId !== item.firebaseId);
    renderFilteredRows();
    closeDeleteModal();
  } catch (err) {
    setMsg(deleteStatus, getDataError(err), "error");
    deleteModalConfirm.disabled = false;
  }
});

// ── Keyboard: close modals on Escape ─────────────
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!editModal.hidden) closeEditModal();
    if (!deleteModal.hidden) closeDeleteModal();
  }
});

// ── CSV download ──────────────────────────────────
function downloadCsv() {
  const headers = [
    "報名編號","報名時間","姓名","性別","電話","Email",
    "教會名稱","地址","衣服尺寸","接送需求","飲食","飲食說明",
    "是否未滿18","身分證字號","生日","家長同意書檔名"
  ];

  const rows = applyFilters(registrations).map((item) => [
    item.registrationId, fmtDate(item.createdAt), item.name, item.gender,
    item.phone, item.email, item.church, item.address, item.shirtSize,
    item.transport, item.diet, item.dietOther || "",
    item.isUnder18 ? "是" : "否", item.nationalId, item.birthday,
    item.consentOriginalName || ""
  ]);

  const csv = "\uFEFF" + [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\r\n");

  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "youth-leadership-camp-registrations.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Helpers ───────────────────────────────────────
function qs(sel) { return document.querySelector(sel); }

function fmtDate(value) {
  const d = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!d || isNaN(d)) return "";
  return new Intl.DateTimeFormat("zh-TW", { dateStyle: "short", timeStyle: "short" }).format(d);
}

function setMsg(el, text, kind) {
  if (!el) return;
  el.textContent = text;
  el.className = `status-msg${kind ? ` ${kind}` : ""}`;
}

function getLoginError(err) {
  const code = err?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password"))
    return "Email 或密碼不正確。";
  if (code.includes("user-not-found")) return "找不到這個帳號。";
  if (code.includes("too-many-requests")) return "嘗試次數過多，請稍後再試。";
  return err?.message || "登入失敗，請稍後再試。";
}

function getDataError(err) {
  if (err?.code?.includes("permission-denied"))
    return "權限不足，請確認 Firebase 規則設定。";
  return err?.message || "操作失敗，請稍後再試。";
}
