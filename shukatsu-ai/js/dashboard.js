// ===== ダミーデータ =====
const DUMMY_LOGS = [
  { time: '14:32', userId: 'U-2841', type: '回避型', turns: 8,  first: '就活したくないです',          status: '進行中' },
  { time: '14:18', userId: 'U-2840', type: 'コミュ型', turns: 12, first: '面接が本当に苦手で話せません', status: '終了' },
  { time: '13:55', userId: 'U-2839', type: '回避型', turns: 3,  first: 'なんかよくわかんないけど…',   status: '終了' },
  { time: '13:40', userId: 'U-2838', type: '迷走型', turns: 9,  first: '大手か中小か悩んでます',       status: '終了' },
  { time: '13:21', userId: 'U-2837', type: '回避型', turns: 5,  first: 'めんどくさくてサボってた',     status: '進行中' },
  { time: '12:58', userId: 'U-2836', type: 'コミュ型', turns: 7,  first: 'ESの書き方がわかりません',   status: '終了' },
  { time: '12:44', userId: 'U-2835', type: '迷走型', turns: 11, first: 'やりたいことが見つからない',    status: '終了' },
  { time: '12:30', userId: 'U-2834', type: '回避型', turns: 2,  first: '就活って何から始めればいい？', status: '終了' },
  { time: '12:10', userId: 'U-2833', type: 'コミュ型', turns: 15, first: 'グループ面接が怖くて仕方ない', status: '終了' },
  { time: '11:55', userId: 'U-2832', type: '回避型', turns: 4,  first: 'とりあえず登録だけした',       status: '終了' },
];

// ===== 型→スタイル変換 =====
function typePill(type) {
  const map = { '回避型': 'pill-avoid', 'コミュ型': 'pill-comm', '迷走型': 'pill-lost' };
  return `<span class="type-pill ${map[type] || ''}">${type}</span>`;
}

function statusCell(status) {
  const cls = status === '進行中' ? 's-active' : 's-done';
  return `<span class="status-cell"><span class="status-dot-sm ${cls}"></span>${status}</span>`;
}

// ===== テーブル描画 =====
function renderTable(tbodyId, data) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = data.map(row => `
    <tr>
      <td style="color:var(--text-secondary)">${row.time}</td>
      <td>${row.userId}</td>
      <td>${typePill(row.type)}</td>
      <td style="text-align:center">${row.turns}</td>
      <td class="truncate" style="color:var(--text-secondary)">${row.first}</td>
      <td>${statusCell(row.status)}</td>
    </tr>
  `).join('');
}

// ===== ドーナツグラフ =====
function initDonut() {
  const ctx = document.getElementById('donutChart');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['回避・先延ばし型', 'コミュ不全型', '情報過多・迷走型'],
      datasets: [{
        data: [60, 30, 10],
        backgroundColor: ['#534AB7', '#1D9E75', '#D85A30'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      cutout: '65%',
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: ctx => ` ${ctx.label}: ${ctx.parsed}%`
      }}},
      animation: { duration: 600 }
    }
  });
}

// ===== 棒グラフ =====
function initBar() {
  const ctx = document.getElementById('barChart');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['月', '火', '水', '木', '金', '土', '日'],
      datasets: [{
        data: [24, 31, 26, 38, 44, 20, 22],
        backgroundColor: ['#EEEDFE','#AFA9EC','#AFA9EC','#7F77DD','#534AB7','#EEEDFE','#EEEDFE'],
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } }
      },
      animation: { duration: 600 }
    }
  });
}

// ===== ナビゲーション =====
function initNav() {
  const navItems = document.querySelectorAll('.db-nav-item[data-page]');
  const pages = document.querySelectorAll('.db-page');
  const pageTitle = document.getElementById('pageTitle');

  const titles = { overview: '概要', logs: '会話ログ', analysis: '型別分析', settings: '設定' };

  navItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const page = item.dataset.page;

      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      pages.forEach(p => p.style.display = 'none');
      const target = document.getElementById(`page-${page}`);
      if (target) target.style.display = 'block';

      if (pageTitle) pageTitle.textContent = titles[page] || page;
    });
  });
}

// ===== フィルター =====
function initFilters() {
  const filterType   = document.getElementById('filterType');
  const filterStatus = document.getElementById('filterStatus');

  function applyFilter() {
    const type   = filterType?.value || '';
    const status = filterStatus?.value || '';
    const filtered = DUMMY_LOGS.filter(row =>
      (!type   || row.type === type) &&
      (!status || row.status === status)
    );
    renderTable('fullLogTableBody', filtered);
    const countEl = document.getElementById('logCount');
    if (countEl) countEl.textContent = `${filtered.length}件`;
  }

  filterType?.addEventListener('change', applyFilter);
  filterStatus?.addEventListener('change', applyFilter);
  applyFilter();
}

// ===== リフレッシュボタン =====
function initRefresh() {
  const btn = document.getElementById('refreshBtn');
  const lastUpdated = document.getElementById('lastUpdated');

  function updateTime() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    if (lastUpdated) lastUpdated.textContent = `${h}:${m}:${s}`;
  }

  updateTime();
  btn?.addEventListener('click', () => {
    btn.style.transform = 'rotate(180deg)';
    btn.style.transition = 'transform 0.4s';
    setTimeout(() => { btn.style.transform = ''; btn.style.transition = ''; }, 400);
    updateTime();
  });
}

// ===== APIキー保存 =====
function saveApiKey() {
  const val = document.getElementById('apiKeyInput')?.value;
  if (val) {
    localStorage.setItem('gemini_api_key', val);
    alert('APIキーを保存しました。');
  }
}

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', () => {
  renderTable('logTableBody', DUMMY_LOGS.slice(0, 5));
  initDonut();
  initBar();
  initNav();
  initFilters();
  initRefresh();

  // 保存済みAPIキーを復元
  const saved = localStorage.getItem('gemini_api_key');
  const input = document.getElementById('apiKeyInput');
  if (saved && input) input.value = saved;
});
