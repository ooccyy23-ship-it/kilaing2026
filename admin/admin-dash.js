// ============================
// admin-dash.js
// 後台主邏輯：讀取報名資料、搜尋、篩選、狀態更新、匯出 Excel
// ============================

import { auth, db } from "../js/firebase-config.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  collection, getDocs, doc, updateDoc, orderBy, query
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// ============================
// 驗證登入狀態
// ============================
onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }
  document.getElementById('adminEmail').textContent = user.email;
  loadRegistrations();
});

// ============================
// DOM refs
// ============================
const tableBody    = document.getElementById('regTableBody');
const tableLoading = document.getElementById('tableLoading');
const tableEmpty   = document.getElementById('tableEmpty');
const tableCount   = document.getElementById('tableCount');
const searchInput  = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const minorFilter  = document.getElementById('minorFilter');
const refreshBtn   = document.getElementById('refreshBtn');
const exportBtn    = document.getElementById('exportBtn');
const logoutBtn    = document.getElementById('logoutBtn');

// Sidebar (mobile)
const sidebar        = document.getElementById('sidebar');
const sidebarToggle  = document.getElementById('sidebarToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');

// Modal
const modalOverlay = document.getElementById('modalOverlay');
const modalBody    = document.getElementById('modalBody');
const modalTitle   = document.getElementById('modalTitle');
const statusActions = document.getElementById('statusActions');

// ============================
// 側欄 mobile toggle
// ============================
sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  sidebarOverlay.classList.toggle('open');
});
sidebarOverlay.addEventListener('click', closeSidebar);
function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('open');
}

// ============================
// 登出
// ============================
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

// ============================
// 資料載入
// ============================
let allData = [];   // 全部資料快取

async function loadRegistrations() {
  setLoading(true);
  try {
    const q = query(
      collection(db, 'registrations'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    allData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateStats(allData);
    renderTable(filterData());
  } catch (err) {
    console.error('載入失敗：', err);
    tableBody.innerHTML = `<tr><td colspan="13" style="text-align:center;color:#E84040;padding:32px">載入失敗：${err.message}</td></tr>`;
  } finally {
    setLoading(false);
  }
}

function setLoading(on) {
  tableLoading.style.display = on ? 'flex' : 'none';
}

// ============================
// 統計卡片
// ============================
function updateStats(data) {
  document.getElementById('statTotal').textContent     = data.length;
  document.getElementById('statPending').textContent   = data.filter(r => r.status === 'pending').length;
  document.getElementById('statConfirmed').textContent = data.filter(r => r.status === 'confirmed').length;
  document.getElementById('statMinor').textContent     = data.filter(r => r.isMinor).length;
}

// ============================
// 搜尋 & 篩選
// ============================
searchInput.addEventListener('input',  () => renderTable(filterData()));
statusFilter.addEventListener('change', () => renderTable(filterData()));
minorFilter.addEventListener('change',  () => renderTable(filterData()));

function filterData() {
  const kw     = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const minor  = minorFilter.value;

  return allData.filter(r => {
    const matchKw = !kw || [r.nameZh, r.email, r.church, r.phone, r.parentName]
      .some(v => (v || '').toLowerCase().includes(kw));
    const matchStatus = !status || r.status === status;
    const matchMinor  = minor === '' || String(r.isMinor) === minor;
    return matchKw && matchStatus && matchMinor;
  });
}

// ============================
// 渲染表格
// ============================
const DIET_LABEL   = { normal: '一般', vegetarian: '素食', vegan: '全素', other: '其他' };
const GENDER_LABEL = { male: '男', female: '女', other: '其他', undisclosed: '不公開' };
const STATUS_LABEL = { pending: '待確認', confirmed: '已確認', cancelled: '已取消' };

function renderTable(data) {
  tableEmpty.hidden = data.length > 0;

  if (data.length === 0) {
    tableBody.innerHTML = '';
    tableCount.textContent = '';
    return;
  }

  tableCount.textContent = `共 ${data.length} 筆`;

  tableBody.innerHTML = data.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td title="${r.nameZh || ''}">${r.nameZh || '—'}</td>
      <td>${GENDER_LABEL[r.gender] || r.gender || '—'}</td>
      <td>${r.birthdate || '—'}</td>
      <td title="${r.church || ''}">${r.church || '—'}</td>
      <td title="${r.email || ''}">${r.email || '—'}</td>
      <td>${r.phone || '—'}</td>
      <td>${r.tshirt || '—'}</td>
      <td>${DIET_LABEL[r.diet] || r.diet || '—'}</td>
      <td><span class="badge badge-${r.status || 'pending'}">${STATUS_LABEL[r.status] || r.status}</span></td>
      <td>${r.consentFileURL
        ? `<a href="${r.consentFileURL}" target="_blank" class="consent-link">下載 ↗</a>`
        : `<span class="consent-none">${r.isMinor ? '⚠ 未上傳' : '免附'}</span>`
      }</td>
      <td>${formatDate(r.createdAt)}</td>
      <td><button class="btn-detail" data-id="${r.id}">詳細</button></td>
    </tr>
  `).join('');

  // 綁定詳細按鈕
  tableBody.querySelectorAll('.btn-detail').forEach(btn => {
    btn.addEventListener('click', () => {
      const rec = allData.find(r => r.id === btn.dataset.id);
      if (rec) openModal(rec);
    });
  });
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ============================
// 刷新
// ============================
refreshBtn.addEventListener('click', async () => {
  refreshBtn.classList.add('spinning');
  await loadRegistrations();
  setTimeout(() => refreshBtn.classList.remove('spinning'), 600);
});

// ============================
// Modal 詳細資料
// ============================
const SHUTTLE_LABEL = { none: '自行前往', arrival: '需去程接送', departure: '需回程接送', both: '去回程皆需接送' };

function mRow(label, val, full = false) {
  return `<div class="modal-row${full ? ' full' : ''}">
    <span class="modal-label">${label}</span>
    <span class="modal-val">${val || '—'}</span>
  </div>`;
}

function openModal(r) {
  modalTitle.textContent = `${r.nameZh} 的報名資料`;

  modalBody.innerHTML = `
    <div class="modal-section">
      <h4>基本資料</h4>
      <div class="modal-grid">
        ${mRow('中文姓名', r.nameZh)}
        ${mRow('性別', GENDER_LABEL[r.gender] || r.gender)}
        ${mRow('出生年月日', r.birthdate)}
        ${mRow('身分證字號', r.idNumber ? r.idNumber.replace(/.(?=.{4})/g, '●') : '')}
        ${mRow('學校', r.school)}
        ${mRow('年級', r.grade)}
        ${mRow('教會 / 單位', r.church, true)}
      </div>
    </div>
    <div class="modal-section">
      <h4>聯絡資料</h4>
      <div class="modal-grid">
        ${mRow('本人手機', r.phone)}
        ${mRow('本人 Email', r.email)}
        ${mRow('通訊地址', r.address, true)}
        ${mRow('家長姓名', r.parentName)}
        ${mRow('家長電話', r.parentPhone)}
        ${mRow('接送需求', SHUTTLE_LABEL[r.shuttle] || r.shuttle)}
      </div>
    </div>
    <div class="modal-section">
      <h4>其他資訊</h4>
      <div class="modal-grid">
        ${mRow('飲食需求', DIET_LABEL[r.diet] || r.diet)}
        ${mRow('T-shirt 尺寸', r.tshirt)}
        ${mRow('過敏 / 健康狀況', r.health || '無', true)}
        ${mRow('備註', r.notes || '無', true)}
      </div>
    </div>
    ${r.isMinor ? `
    <div class="modal-section">
      <h4>家長同意書</h4>
      <div class="modal-grid">
        ${r.consentFileURL
          ? `<div class="modal-row full"><span class="modal-label">附件</span>
             <a href="${r.consentFileURL}" target="_blank" class="consent-link">點此下載 / 查看 ↗</a></div>`
          : `<div class="modal-row full"><span class="modal-label">附件</span>
             <span style="color:#E84040;font-weight:700">⚠ 未上傳同意書</span></div>`
        }
      </div>
    </div>` : ''}
    <div class="modal-section">
      <h4>報名狀態</h4>
      <div class="modal-grid">
        ${mRow('目前狀態', `<span class="badge badge-${r.status}">${STATUS_LABEL[r.status]}</span>`)}
        ${mRow('報名時間', formatDate(r.createdAt))}
        ${mRow('文件 ID', r.id)}
      </div>
    </div>
  `;

  // 狀態操作按鈕（排除目前狀態）
  statusActions.innerHTML = '';
  if (r.status !== 'confirmed') {
    const btn = document.createElement('button');
    btn.className = 'btn-status btn-confirm';
    btn.textContent = '✓ 確認報名';
    btn.addEventListener('click', () => updateStatus(r.id, 'confirmed'));
    statusActions.appendChild(btn);
  }
  if (r.status !== 'pending') {
    const btn = document.createElement('button');
    btn.className = 'btn-status btn-pending';
    btn.textContent = '↩ 設為待確認';
    btn.addEventListener('click', () => updateStatus(r.id, 'pending'));
    statusActions.appendChild(btn);
  }
  if (r.status !== 'cancelled') {
    const btn = document.createElement('button');
    btn.className = 'btn-status btn-cancel';
    btn.textContent = '✕ 取消報名';
    btn.addEventListener('click', () => updateStatus(r.id, 'cancelled'));
    statusActions.appendChild(btn);
  }

  modalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.hidden = true;
  document.body.style.overflow = '';
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalClose2').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ============================
// 更新報名狀態
// ============================
async function updateStatus(id, newStatus) {
  try {
    await updateDoc(doc(db, 'registrations', id), { status: newStatus });
    // 更新本地快取
    const rec = allData.find(r => r.id === id);
    if (rec) rec.status = newStatus;
    updateStats(allData);
    renderTable(filterData());
    closeModal();
  } catch (err) {
    alert(`更新失敗：${err.message}`);
  }
}

// ============================
// 匯出 Excel（純前端，使用 SheetJS CDN）
// ============================
exportBtn.addEventListener('click', exportExcel);

async function exportExcel() {
  // 動態載入 SheetJS
  if (!window.XLSX) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  }

  const data = filterData();
  if (data.length === 0) { alert('沒有資料可以匯出'); return; }

  const rows = data.map((r, i) => ({
    '#':         i + 1,
    '中文姓名':   r.nameZh || '',
    '性別':      GENDER_LABEL[r.gender] || r.gender || '',
    '出生年月日': r.birthdate || '',
    '學校':      r.school || '',
    '年級':      r.grade || '',
    '教會單位':   r.church || '',
    '未滿18歲':  r.isMinor ? '是' : '否',
    '本人手機':   r.phone || '',
    '本人Email':  r.email || '',
    '通訊地址':   r.address || '',
    '家長姓名':   r.parentName || '',
    '家長電話':   r.parentPhone || '',
    '接送需求':   SHUTTLE_LABEL[r.shuttle] || r.shuttle || '',
    '飲食需求':   DIET_LABEL[r.diet] || r.diet || '',
    'T-shirt尺寸': r.tshirt || '',
    '健康狀況':   r.health || '',
    '備註':      r.notes || '',
    '報名狀態':   STATUS_LABEL[r.status] || r.status || '',
    '家長同意書': r.consentFileURL ? r.consentFileURL : (r.isMinor ? '未上傳' : '免附'),
    '報名時間':   formatDate(r.createdAt),
    '文件ID':    r.id,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '報名資料');

  // 自動欄寬
  const colWidths = Object.keys(rows[0]).map(k => ({
    wch: Math.max(k.length * 2, ...rows.map(r => String(r[k] || '').length)) + 2
  }));
  ws['!cols'] = colWidths;

  const date = new Date();
  const fname = `青年領袖營報名_${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}.xlsx`;
  XLSX.writeFile(wb, fname);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
