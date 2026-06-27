import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  initializeAppCheck,
  ReCaptchaV3Provider
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app-check.js";
import {
  getAuth,
  onAuthStateChanged,
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
  runTransaction,
  updateDoc
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

const rowsEl = document.querySelector("#registrationRows");
const refreshButton = document.querySelector("#refreshButton");
const downloadButton = document.querySelector("#downloadCsvButton");
const logoutButton = document.querySelector("#logoutButton");
const adminEmail = document.querySelector("#adminEmail");
const searchInput = document.querySelector("#searchInput");
const transportFilter = document.querySelector("#transportFilter");
const summaryEl = document.querySelector("#adminSummary");
const editDialog = document.querySelector("#editDialog");
const editForm = document.querySelector("#editForm");
const editStatus = document.querySelector("#editStatus");
const closeEditDialogButton = document.querySelector("#closeEditDialogButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const editDietSelect = document.querySelector("#editDietSelect");
const editDietOtherWrap = document.querySelector("#editDietOtherWrap");
const under18Notice = document.querySelector("#under18Notice");

let registrations = [];
let currentEditId = "";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./admin.html";
    return;
  }

  if (adminEmail) adminEmail.textContent = user.email || "";
  await loadRegistrations();
});

logoutButton?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./admin.html";
});
refreshButton?.addEventListener("click", loadRegistrations);
downloadButton?.addEventListener("click", downloadCsv);
searchInput?.addEventListener("input", renderFilteredRows);
transportFilter?.addEventListener("change", renderFilteredRows);
closeEditDialogButton?.addEventListener("click", closeEditDialog);
cancelEditButton?.addEventListener("click", closeEditDialog);
editDietSelect?.addEventListener("change", syncEditDietOtherVisibility);
editForm?.addEventListener("submit", saveEditForm);

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
  td.colSpan = 13;
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
  tr.appendChild(actionCell(item));
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

function actionCell(item) {
  const td = document.createElement("td");
  const wrap = document.createElement("div");
  wrap.className = "admin-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "button secondary admin-inline-button";
  editButton.textContent = "編輯";
  editButton.addEventListener("click", () => openEditDialog(item));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "button danger admin-inline-button";
  deleteButton.textContent = "刪除";
  deleteButton.addEventListener("click", () => deleteRegistration(item));

  wrap.appendChild(editButton);
  wrap.appendChild(deleteButton);
  td.appendChild(wrap);
  return td;
}

function cell(text) {
  const td = document.createElement("td");
  td.textContent = text ?? "";
  return td;
}

function openEditDialog(item) {
  currentEditId = item.firebaseId;
  if (!editForm || !editDialog) return;

  editForm.name.value = item.name || "";
  editForm.campType.value = item.campType || "青年領袖營";
  editForm.gender.value = item.gender || "男";
  editForm.phone.value = item.phone || "";
  editForm.email.value = item.email || "";
  editForm.transport.value = item.transport || "自行前往";
  editForm.birthday.value = item.birthday || "";
  editForm.nationalId.value = item.nationalId || "";
  editForm.diet.value = item.diet || "葷食";
  editForm.dietOther.value = item.dietOther || "";
  editForm.shirtSize.value = item.shirtSize || "M";
  editForm.church.value = item.church || "";
  editForm.address.value = item.address || "";
  editForm.consentOriginalName.value = item.consentOriginalName || "";

  if (under18Notice) under18Notice.hidden = !item.isUnder18;
  syncEditDietOtherVisibility();
  setStatus(editStatus, "", "");
  editDialog.showModal();
}

function closeEditDialog() {
  if (!editDialog) return;
  editDialog.close();
  currentEditId = "";
  setStatus(editStatus, "", "");
}

function syncEditDietOtherVisibility() {
  if (!editForm || !editDietOtherWrap) return;
  editDietOtherWrap.hidden = editForm.diet?.value !== "其他";
}

async function saveEditForm(event) {
  event.preventDefault();
  if (!currentEditId || !editForm) return;
  setStatus(editStatus, "儲存中...", "");

  const formData = new FormData(editForm);
  const payload = {
    campType: String(formData.get("campType") || "").trim(),
    name: String(formData.get("name") || "").trim(),
    gender: String(formData.get("gender") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    transport: String(formData.get("transport") || "").trim(),
    birthday: String(formData.get("birthday") || "").trim(),
    nationalId: String(formData.get("nationalId") || "").trim().toUpperCase(),
    diet: String(formData.get("diet") || "").trim(),
    dietOther: String(formData.get("dietOther") || "").trim(),
    shirtSize: String(formData.get("shirtSize") || "").trim(),
    church: String(formData.get("church") || "").trim(),
    address: String(formData.get("address") || "").trim(),
    consentOriginalName: String(formData.get("consentOriginalName") || "").trim()
  };

  if (payload.diet !== "其他") {
    payload.dietOther = "";
  }

  try {
    const original = registrations.find((item) => item.firebaseId === currentEditId);
    if (!original) {
      throw new Error("找不到原始資料，請重新整理後再試。");
    }

    const originalNationalIdKey = await hashValue(original.nationalId || "");
    const nextNationalIdKey = await hashValue(payload.nationalId);

    await runTransaction(db, async (transaction) => {
      const originalLockRef = doc(db, "registrationLocks", originalNationalIdKey);
      const nextLockRef = doc(db, "registrationLocks", nextNationalIdKey);
      const nextLockSnapshot = await transaction.get(nextLockRef);

      if (payload.nationalId !== original.nationalId && nextLockSnapshot.exists()) {
        throw duplicateError("這個身分證字號已經有人報名過了。");
      }

      transaction.update(doc(db, "registrations", currentEditId), payload);

      if (payload.nationalId !== original.nationalId) {
        transaction.delete(originalLockRef);
        transaction.set(nextLockRef, {
          type: "nationalId",
          value: payload.nationalId,
          createdAt: new Date()
        });
      }
    });

    await loadRegistrations();
    closeEditDialog();
  } catch (error) {
    setStatus(editStatus, getDataErrorMessage(error), "error");
  }
}

async function deleteRegistration(item) {
  const confirmed = window.confirm(`確定要刪除「${item.name || "這筆資料"}」嗎？`);
  if (!confirmed) return;

  const second = window.prompt(`請輸入「刪除」以確認刪除 ${item.name || "這筆資料"}。`);
  if (second !== "刪除") return;

  try {
    const nationalIdKey = await hashValue(item.nationalId || "");
    await runTransaction(db, async (transaction) => {
      transaction.delete(doc(db, "registrations", item.firebaseId));
      transaction.delete(doc(db, "registrationLocks", nationalIdKey));
    });
    await loadRegistrations();
  } catch (error) {
    alert(getDataErrorMessage(error));
  }
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

async function hashValue(value) {
  const text = String(value || "").trim().toUpperCase();
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function duplicateError(message) {
  const error = new Error(message);
  error.code = "duplicate-registration";
  return error;
}

function setStatus(element, message, kind) {
  if (!element) return;
  element.textContent = message;
  element.className = kind ? `form-status ${kind}` : "form-status";
}

function getDataErrorMessage(error) {
  const code = String(error?.code || "");
  if (code.includes("permission-denied")) {
    return "權限不足，請確認 Firestore 或 Storage 規則。";
  }
  if (code.includes("duplicate-registration")) {
    return error.message;
  }
  return error?.message || "發生未預期的錯誤。";
}
