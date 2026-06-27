import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  initializeAppCheck,
  ReCaptchaV3Provider
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app-check.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import {
  deleteObject,
  getStorage,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
if (firebaseConfig.appCheckSiteKey && firebaseConfig.appCheckSiteKey !== "PASTE_RECAPTCHA_V3_SITE_KEY") {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(firebaseConfig.appCheckSiteKey),
    isTokenAutoRefreshEnabled: true
  });
}

const db = getFirestore(app);
const storage = getStorage(app);

const form = document.querySelector("#registrationForm");
const statusEl = document.querySelector("#formStatus");
const ageStatusEl = document.querySelector("#ageStatus");
const birthdayInput = document.querySelector("#regBirthday");
const consentWrapper = document.querySelector("#parentConsentWrapper");
const consentInput = document.querySelector("#parentConsentInput");
const consentRequiredMark = document.querySelector("#consentRequiredMark");
const downloadAgreementWrapper = document.querySelector("#downloadAgreementWrapper");
const dietSelect = document.querySelector("#dietSelect");
const dietOtherWrap = document.querySelector("#dietOtherWrap");
const dietOtherInput = document.querySelector("#dietOtherInput");

const CAMP_START_DATE = new Date("2026-07-12T00:00:00");
let submitLock = false;

updateAgeState();
updateDietState();
birthdayInput?.addEventListener("change", updateAgeState);
birthdayInput?.addEventListener("input", updateAgeState);
dietSelect?.addEventListener("change", updateDietState);

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitLock) return;

  const submitButton = form.querySelector("button[type='submit']");
  const formData = new FormData(form);
  const ageState = updateAgeState();
  const campType = clean(formData.get("campType"));
  const diet = clean(formData.get("diet"));
  const dietOther = clean(formData.get("dietOther"));
  const email = clean(formData.get("email"));
  const nationalId = cleanUpper(formData.get("nationalId"));
  const phone = clean(formData.get("phone"));
  const consentFile = formData.get("parentConsent");
  const registrationId = createRegistrationId();
  let nationalIdKey = "";
  let consentStoragePath = null;

  setStatus("正在送出報名資料...", "");
  submitLock = true;
  if (submitButton) submitButton.disabled = true;

  try {
    if (!campType) {
      throw new Error("請先選擇報名項目。");
    }

    if (!validateNationalIdFormat(nationalId)) {
      throw new Error("身分證字號格式不正確，請輸入 1 個英文字母 + 9 個數字，例如 A123456789。");
    }

    if (!validateNationalIdChecksum(nationalId)) {
      throw new Error("身分證字號檢查碼不正確，請確認是否輸入錯誤。");
    }

    if (!validatePhone(phone)) {
      throw new Error("電話格式不正確，台灣手機請輸入 09XXXXXXXX。");
    }

    if (diet === "其他" && !dietOther) {
      throw new Error("請在「飲食說明」欄位補充其他飲食需求。");
    }

    nationalIdKey = await hashValue(nationalId);
    await reserveNationalId(nationalIdKey, nationalId);

    let consentOriginalName = null;

    if (ageState.isUnder18) {
      if (!consentFile || !consentFile.size) {
        throw new Error("未滿 18 歲者必須上傳家長同意書。");
      }

      if (consentFile.size > 20 * 1024 * 1024) {
        throw new Error("家長同意書檔案過大，請控制在 20MB 以內。");
      }

      consentOriginalName = sanitizeFilename(consentFile.name);
      consentStoragePath = `parent-consent-forms/${registrationId}-${consentOriginalName}`;

      await uploadBytes(ref(storage, consentStoragePath), consentFile, {
        contentType: consentFile.type || "application/octet-stream"
      });
    }

    await addDoc(collection(db, "registrations"), {
      registrationId,
      campType,
      name: clean(formData.get("name")),
      gender: clean(formData.get("gender")),
      diet,
      dietOther: diet === "其他" ? dietOther : "",
      nationalId,
      birthday: clean(formData.get("birthday")),
      phone,
      email,
      church: clean(formData.get("church")),
      address: clean(formData.get("address")),
      shirtSize: clean(formData.get("shirtSize")),
      transport: clean(formData.get("transport")),
      isUnder18: ageState.isUnder18,
      consentOriginalName,
      consentStoragePath,
      createdAt: serverTimestamp()
    });

    form.reset();
    updateAgeState();
    updateDietState();
    setStatus("報名成功，感謝你的提交！", "success");
  } catch (error) {
    await rollbackPartialWrite(nationalIdKey, consentStoragePath);
    if (error?.code === "duplicate-registration") {
      setStatus(error.message, "error");
    } else {
      setStatus(getReadableError(error, "送出失敗，請稍後再試。"), "error");
    }
  } finally {
    submitLock = false;
    if (submitButton) submitButton.disabled = false;
  }
});

function updateDietState() {
  const showOther = String(dietSelect?.value || "") === "其他";
  if (dietOtherWrap) dietOtherWrap.hidden = !showOther;
  if (dietOtherInput) {
    dietOtherInput.required = showOther;
    if (!showOther) dietOtherInput.value = "";
  }
}

function updateAgeState() {
  const birthdayValue = String(birthdayInput?.value || "").trim();
  if (!birthdayValue) {
    setConsentVisibility(false);
    if (ageStatusEl) ageStatusEl.textContent = "";
    return { isUnder18: false, age: null };
  }

  const birthDate = new Date(`${birthdayValue}T00:00:00`);
  const age = getAgeAtDate(birthDate, CAMP_START_DATE);
  const isUnder18 = age < 18;

  if (ageStatusEl) {
    ageStatusEl.textContent = isUnder18
      ? `目前計算為 ${age} 歲，未滿 18 歲者需要上傳家長同意書。`
      : `目前計算為 ${age} 歲，已滿 18 歲，可直接送出報名。`;
    ageStatusEl.className = `form-status ${isUnder18 ? "error" : "success"}`;
  }

  setConsentVisibility(isUnder18);
  return { isUnder18, age };
}

function setConsentVisibility(visible) {
  if (consentWrapper) consentWrapper.hidden = !visible;
  if (downloadAgreementWrapper) downloadAgreementWrapper.hidden = !visible;
  if (consentRequiredMark) consentRequiredMark.style.display = visible ? "inline" : "none";
  if (consentInput) {
    consentInput.required = visible;
    if (!visible) consentInput.value = "";
  }
}

function getAgeAtDate(birthDate, referenceDate) {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
  const dayDiff = referenceDate.getDate() - birthDate.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age--;
  return age;
}

function validateNationalIdFormat(value) {
  return /^[A-Z][12][0-9]{8}$/.test(String(value || "").trim().toUpperCase());
}

function validateNationalIdChecksum(value) {
  const id = String(value || "").trim().toUpperCase();
  if (!validateNationalIdFormat(id)) return false;

  const letterMap = {
    A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 34, J: 18,
    K: 19, L: 20, M: 21, N: 22, O: 35, P: 23, Q: 24, R: 25, S: 26, T: 27,
    U: 28, V: 29, W: 32, X: 30, Y: 31, Z: 33
  };

  const mapped = letterMap[id[0]];
  if (!mapped) return false;

  const digits = [
    Math.floor(mapped / 10),
    mapped % 10,
    ...id.slice(1).split("").map((n) => Number(n))
  ];
  const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1];
  const sum = digits.reduce((acc, digit, index) => acc + digit * weights[index], 0);
  return sum % 10 === 0;
}

function validatePhone(value) {
  return /^09[0-9]{8}$/.test(String(value || "").trim());
}

function createRegistrationId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
  return `${stamp}-${random}`;
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function cleanUpper(value) {
  return clean(value).toUpperCase();
}

async function hashValue(value) {
  const text = cleanUpper(value);
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function reserveNationalId(nationalIdKey, nationalId) {
  const lockRef = doc(db, "registrationLocks", nationalIdKey);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(lockRef);
    if (snapshot.exists()) {
      throw duplicateError("這個身分證字號已經有人報名過了。");
    }

    transaction.set(lockRef, {
      type: "nationalId",
      value: nationalId,
      createdAt: serverTimestamp()
    });
    return true;
  });
}

async function rollbackPartialWrite(nationalIdKey, consentStoragePath) {
  const tasks = [];
  if (nationalIdKey) {
    tasks.push(deleteDoc(doc(db, "registrationLocks", nationalIdKey)).catch(() => {}));
  }
  if (consentStoragePath) {
    tasks.push(deleteObject(ref(storage, consentStoragePath)).catch(() => {}));
  }
  await Promise.all(tasks);
}

function duplicateError(message) {
  const error = new Error(message);
  error.code = "duplicate-registration";
  return error;
}

function sanitizeFilename(filename) {
  return String(filename || "parental-consent")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 160);
}

function setStatus(message, kind) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `form-status${kind ? ` ${kind}` : ""}`;
}

function getReadableError(error, fallback) {
  const code = String(error?.code || "");
  if (code.includes("permission-denied") || code.includes("unauthorized")) {
    return "Firebase 權限不足，請確認 Firestore 或 Storage 規則。";
  }
  return error?.message || fallback;
}
