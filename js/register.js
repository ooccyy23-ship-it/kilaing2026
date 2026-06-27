// ============================
// register.js
// 功能：多步驟表單、出生日期年齡判斷、家長同意書顯示邏輯、
//       表單驗證、摘要產生、檔案上傳預覽、Firebase 寫入
// ============================

import { db, storage } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL }
  from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";

// ----- 活動開始日 -----
const CAMP_START = new Date('2026-07-24');

// ----- DOM refs -----
const form        = document.getElementById('regForm');
const steps       = document.querySelectorAll('.form-step');
const progressSteps = document.querySelectorAll('.progress-step');
const progressLines = document.querySelectorAll('.progress-line');

const birthdateInput = document.getElementById('birthdate');
const ageHint        = document.getElementById('ageHint');
const consentBlock   = document.getElementById('consentBlock');
const consentFile    = document.getElementById('consentFile');
const uploadArea     = document.getElementById('uploadArea');
const uploadUi       = document.getElementById('uploadUi');
const uploadPreview  = document.getElementById('uploadPreview');
const previewName    = document.getElementById('previewName');
const removeFileBtn  = document.getElementById('removeFile');

const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');

let currentStep = 1;
let isMinor = false;          // 是否未滿 18 歲
let uploadedFile = null;      // 儲存上傳的檔案

// ============================
// Navbar mobile toggle
// ============================
navToggle?.addEventListener('click', () => navLinks.classList.toggle('open'));

// ============================
// 步驟切換
// ============================
function goToStep(n) {
  steps.forEach(s => s.classList.remove('active'));
  document.getElementById(`step${n}`).classList.add('active');

  progressSteps.forEach((ps, i) => {
    ps.classList.remove('active', 'done');
    if (i + 1 < n)  ps.classList.add('done');
    if (i + 1 === n) ps.classList.add('active');
  });
  progressLines.forEach((pl, i) => {
    pl.classList.toggle('done', i + 1 < n);
  });

  currentStep = n;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (n === 4) buildSummary();
}

document.getElementById('next1').addEventListener('click', () => {
  if (validateStep1()) goToStep(2);
});
document.getElementById('next2').addEventListener('click', () => {
  if (validateStep2()) goToStep(3);
});
document.getElementById('next3').addEventListener('click', () => {
  if (validateStep3()) goToStep(4);
});
document.getElementById('back2').addEventListener('click', () => goToStep(1));
document.getElementById('back3').addEventListener('click', () => goToStep(2));
document.getElementById('back4').addEventListener('click', () => goToStep(3));

// ============================
// 出生日期 → 年齡判斷
// ============================
birthdateInput.addEventListener('change', handleBirthdate);

function handleBirthdate() {
  const val = birthdateInput.value;
  if (!val) {
    ageHint.textContent = '';
    ageHint.className = 'field-hint';
    setConsentVisible(false);
    return;
  }

  const birth = new Date(val);
  const age18Date = new Date(birth);
  age18Date.setFullYear(age18Date.getFullYear() + 18);

  isMinor = age18Date > CAMP_START;    // 活動當天未滿 18

  if (isMinor) {
    const diff = Math.ceil((CAMP_START - birth) / (1000 * 60 * 60 * 24 * 365.25));
    ageHint.textContent = `活動當天年齡：${diff} 歲（未滿 18 歲，需上傳家長同意書）`;
    ageHint.className = 'field-hint age-minor';
    setConsentVisible(true);
  } else {
    const diff = Math.floor((CAMP_START - birth) / (1000 * 60 * 60 * 24 * 365.25));
    ageHint.textContent = `活動當天年齡：${diff} 歲（已成年，免附家長同意書）`;
    ageHint.className = 'field-hint age-ok';
    setConsentVisible(false);
  }
}

function setConsentVisible(show) {
  consentBlock.hidden = !show;
  if (!show) {
    // 清除已上傳檔案
    uploadedFile = null;
    resetUploadUI();
  }
}

// ============================
// 檔案上傳預覽
// ============================
consentFile.addEventListener('change', handleFileSelect);

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!validateFileType(file)) {
    showErr('err-consentFile', '請上傳 PDF、JPG 或 PNG 格式，最大 5MB');
    return;
  }
  setUploadedFile(file);
}

// Drag & drop
uploadArea.addEventListener('dragover', e => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (!validateFileType(file)) {
    showErr('err-consentFile', '請上傳 PDF、JPG 或 PNG 格式，最大 5MB');
    return;
  }
  setUploadedFile(file);
});

function validateFileType(file) {
  const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  return allowed.includes(file.type) && file.size <= maxSize;
}

function setUploadedFile(file) {
  uploadedFile = file;
  clearErr('err-consentFile');
  uploadUi.hidden = true;
  uploadPreview.hidden = false;
  previewName.textContent = file.name;
  uploadArea.classList.add('has-file');
}

function resetUploadUI() {
  uploadUi.hidden = false;
  uploadPreview.hidden = true;
  previewName.textContent = '';
  uploadArea.classList.remove('has-file');
  consentFile.value = '';
}

removeFileBtn.addEventListener('click', e => {
  e.stopPropagation();
  uploadedFile = null;
  resetUploadUI();
});

// ============================
// 驗證工具函式
// ============================
function showErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
  // 也標記 input 紅框
  const inputId = id.replace('err-', '');
  const input = document.getElementById(inputId);
  input?.classList.add('error');
}

function clearErr(id) {
  const el = document.getElementById(id);
  if (el) el.textContent = '';
  const inputId = id.replace('err-', '');
  const input = document.getElementById(inputId);
  input?.classList.remove('error');
}

function clearAllErrors(...ids) {
  ids.forEach(clearErr);
}

function isValidTWID(id) {
  // 台灣身分證字號格式驗證
  const re = /^[A-Z][12]\d{8}$/;
  if (!re.test(id.toUpperCase())) return false;
  const letters = 'ABCDEFGHJKLMNPQRSTUVXYWZIO';
  const n = letters.indexOf(id[0]) + 10;
  const digits = [Math.floor(n / 10), n % 10, ...id.slice(1).split('').map(Number)];
  const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1];
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
  return sum % 10 === 0;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}$/.test(phone.trim());
}

// ============================
// 各步驟驗證
// ============================
function validateStep1() {
  let ok = true;
  clearAllErrors('err-nameZh', 'err-gender', 'err-idNumber', 'err-birthdate', 'err-church', 'err-consentFile');

  const nameZh = document.getElementById('nameZh').value.trim();
  const gender  = document.getElementById('gender').value;
  const idNum   = document.getElementById('idNumber').value.trim();
  const bdate   = document.getElementById('birthdate').value;
  const church  = document.getElementById('church').value.trim();

  if (!nameZh) {
    showErr('err-nameZh', '請填寫中文姓名');
    ok = false;
  }
  if (!gender) {
    showErr('err-gender', '請選擇性別');
    ok = false;
  }
  if (!idNum) {
    showErr('err-idNumber', '請填寫身分證字號');
    ok = false;
  } else if (!isValidTWID(idNum)) {
    showErr('err-idNumber', '身分證字號格式不正確');
    ok = false;
  }
  if (!bdate) {
    showErr('err-birthdate', '請填寫出生年月日');
    ok = false;
  }
  if (!church) {
    showErr('err-church', '請填寫教會或所屬單位');
    ok = false;
  }

  // 未滿 18 歲且顯示同意書時，檢查是否上傳
  if (isMinor && !uploadedFile) {
    showErr('err-consentFile', '未滿 18 歲必須上傳已簽署的家長同意書');
    ok = false;
  }

  return ok;
}

function validateStep2() {
  let ok = true;
  clearAllErrors('err-phone', 'err-email', 'err-address', 'err-parentName', 'err-parentPhone');

  const phone       = document.getElementById('phone').value.trim();
  const email       = document.getElementById('email').value.trim();
  const address     = document.getElementById('address').value.trim();
  const parentName  = document.getElementById('parentName').value.trim();
  const parentPhone = document.getElementById('parentPhone').value.trim();

  if (!phone) {
    showErr('err-phone', '請填寫本人手機');
    ok = false;
  } else if (!isValidPhone(phone)) {
    showErr('err-phone', '請輸入有效的手機號碼');
    ok = false;
  }
  if (!email) {
    showErr('err-email', '請填寫 Email');
    ok = false;
  } else if (!isValidEmail(email)) {
    showErr('err-email', '請輸入有效的 Email 格式');
    ok = false;
  }
  if (!address) {
    showErr('err-address', '請填寫通訊地址');
    ok = false;
  }
  if (!parentName) {
    showErr('err-parentName', '請填寫家長姓名');
    ok = false;
  }
  if (!parentPhone) {
    showErr('err-parentPhone', '請填寫家長電話');
    ok = false;
  }

  return ok;
}

function validateStep3() {
  let ok = true;
  clearAllErrors('err-tshirt');

  const tshirt = document.getElementById('tshirt').value;
  if (!tshirt) {
    showErr('err-tshirt', '請選擇 T-shirt 尺寸');
    ok = false;
  }

  return ok;
}

// ============================
// 摘要產生（Step 4）
// ============================
const DIET_LABEL = { normal: '一般（無特殊需求）', vegetarian: '素食', vegan: '全素', other: '其他' };
const SHUTTLE_LABEL = { none: '自行前往與返回', arrival: '需要去程接送', departure: '需要回程接送', both: '去程與回程皆需接送' };
const GENDER_LABEL = { male: '男', female: '女', other: '其他', undisclosed: '不公開' };

function row(label, val, full = false) {
  if (!val) return '';
  return `<div class="summary-row${full ? ' full' : ''}">
    <span class="sum-label">${label}</span>
    <span class="sum-val">${val}</span>
  </div>`;
}

function buildSummary() {
  const v = id => document.getElementById(id)?.value?.trim() || '';
  const checked = name => document.querySelector(`input[name="${name}"]:checked`)?.value || '';

  document.getElementById('sum-basic').innerHTML = [
    row('中文姓名', v('nameZh')),
    row('性別', GENDER_LABEL[v('gender')] || v('gender')),
    row('身分證字號', v('idNumber').replace(/.(?=.{4})/g, '●')), // 遮蔽前段
    row('出生年月日', v('birthdate')),
    row('學校', v('school')),
    row('年級', v('grade')),
    row('教會 / 所屬單位', v('church')),
  ].join('');

  document.getElementById('sum-contact').innerHTML = [
    row('本人手機', v('phone')),
    row('本人 Email', v('email')),
    row('通訊地址', v('address'), true),
    row('家長姓名', v('parentName')),
    row('家長電話', v('parentPhone')),
    row('接送需求', SHUTTLE_LABEL[checked('shuttle')]),
  ].join('');

  document.getElementById('sum-other').innerHTML = [
    row('飲食需求', DIET_LABEL[checked('diet')] || checked('diet')),
    row('T-shirt 尺寸', v('tshirt')),
    row('過敏 / 健康狀況', v('health') || '無', true),
    row('備註', v('notes') || '無', true),
  ].join('');

  // 家長同意書摘要
  const consentSection = document.getElementById('sum-consent-section');
  const consentGrid    = document.getElementById('sum-consent');
  if (isMinor && uploadedFile) {
    consentSection.hidden = false;
    consentGrid.innerHTML = row('上傳檔案', `✅ ${uploadedFile.name}`, true);
  } else {
    consentSection.hidden = true;
  }
}

// ============================
// 送出表單
// ============================
form.addEventListener('submit', async e => {
  e.preventDefault();

  // 再次驗證隱私同意
  const agree = document.getElementById('agreePrivacy');
  if (!agree.checked) {
    showErr('err-agreePrivacy', '請勾選同意個人資料使用聲明');
    return;
  }
  clearErr('err-agreePrivacy');

  // 切換按鈕為載入狀態
  const submitBtn    = document.getElementById('submitBtn');
  const submitText   = submitBtn.querySelector('.submit-text');
  const submitLoading = submitBtn.querySelector('.submit-loading');
  submitBtn.disabled  = true;
  submitText.hidden   = true;
  submitLoading.hidden = false;

  try {
    const v = id => document.getElementById(id)?.value?.trim() || '';
    const checked = name => document.querySelector(`input[name="${name}"]:checked`)?.value || '';

    // 1. 若有同意書，先上傳至 Storage
    let consentFileURL = null;
    if (isMinor && uploadedFile) {
      const ext      = uploadedFile.name.split('.').pop();
      const fileName = `consent_${Date.now()}_${v('idNumber').slice(-4)}.${ext}`;
      const fileRef  = ref(storage, `consent-forms/${fileName}`);
      await uploadBytes(fileRef, uploadedFile);
      consentFileURL = await getDownloadURL(fileRef);
    }

    // 2. 寫入 Firestore
    const docRef = await addDoc(collection(db, 'registrations'), {
      // 基本資料
      nameZh:    v('nameZh'),
      gender:    v('gender'),
      idNumber:  v('idNumber'),
      birthdate: v('birthdate'),
      school:    v('school'),
      grade:     v('grade'),
      church:    v('church'),
      isMinor,

      // 聯絡資料
      phone:       v('phone'),
      email:       v('email'),
      address:     v('address'),
      parentName:  v('parentName'),
      parentPhone: v('parentPhone'),
      shuttle:     checked('shuttle'),

      // 其他資訊
      diet:   checked('diet'),
      tshirt: v('tshirt'),
      health: v('health'),
      notes:  v('notes'),

      // 家長同意書
      consentFileURL: consentFileURL || null,

      // 系統欄位
      status:    'pending',       // pending | confirmed | cancelled
      createdAt: serverTimestamp(),
    });

    console.log('報名成功，文件 ID：', docRef.id);
    showSuccess(v('nameZh'), v('email'));

  } catch (err) {
    console.error('送出失敗：', err);
    submitBtn.disabled   = false;
    submitText.hidden    = false;
    submitLoading.hidden = true;
    alert('送出失敗，請稍後再試。');
  }
});

function showSuccess(name, email) {
  form.style.display = 'none';
  document.getElementById('progressBar').style.display = 'none';
  const card = document.getElementById('successCard');
  card.hidden = false;
  document.getElementById('successInfo').innerHTML = `
    <div>姓名：${name}</div>
    <div>確認信將寄送至：${email}</div>
  `;
}

// ============================
// Navbar scroll shadow
// ============================
window.addEventListener('scroll', () => {
  document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 20);
});
