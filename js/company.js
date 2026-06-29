// ===== 企業一覧ページ =====

const grid = document.getElementById('companyGrid');
const resultsCount = document.getElementById('resultsCount');

const filters = {
  industry:   document.getElementById('filterIndustry'),
  remote:     document.getElementById('filterRemote'),
  holidays:   document.getElementById('filterHolidays'),
  overtime:   document.getElementById('filterOvertime'),
  transfer:   document.getElementById('filterTransfer'),
  science:    document.getElementById('filterScience'),
};

// 業界ごとの色
const industryColors = {
  'IT':       '#534AB7',
  '製造':     '#5A6A85',
  '金融':     '#1B2A47',
  '教育':     '#00B4A6',
  '小売':     '#F5A623',
  'サービス': '#D85A30',
  'コンサル': '#534AB7',
  'メディア': '#F5A623',
  '医療':     '#00B4A6',
  '建設':     '#5A6A85',
  'エネルギー': '#1B2A47',
};

// リモート可否のラベル
const remoteLabels = {
  full:    'フルリモート可',
  partial: '一部リモート可',
  none:    '出社',
};

// 検索実行
async function searchCompanies() {
  grid.innerHTML = '<div class="comp-loading">検索中...</div>';
  resultsCount.textContent = '';

  // クエリパラメータを組み立て
  const params = new URLSearchParams();
  if (filters.industry.value) params.set('industry', filters.industry.value);
  if (filters.remote.value)   params.set('remote_work', filters.remote.value);
  if (filters.holidays.value) params.set('min_holidays', filters.holidays.value);
  if (filters.overtime.value) params.set('max_overtime', filters.overtime.value);
  if (filters.transfer.value) params.set('transfer', filters.transfer.value);
  if (filters.science.value)  params.set('arts_or_sciences', filters.science.value);
  params.set('limit', '50');

  const data = await apiGet(`/api/companies/search?${params.toString()}`);

  if (!data || !data.companies) {
    grid.innerHTML = '<div class="comp-empty">取得に失敗しました</div>';
    resultsCount.textContent = '';
    return;
  }

  renderCompanies(data.companies);
}

// 企業カードを描画
function renderCompanies(companies) {
  resultsCount.textContent = `${companies.length}社`;

  if (companies.length === 0) {
    grid.innerHTML = '<div class="comp-empty">条件に合う企業が見つかりませんでした<br>条件を緩めてみてください</div>';
    return;
  }

  grid.innerHTML = companies.map(c => {
    const industryColor = industryColors[c.industry] || '#5A6A85';
    const remote = remoteLabels[c.remote_work] || '';
    const tags = (c.culture_tags || '').split(',').slice(0, 3).map(t => t.trim()).filter(t => t);

    return `
      <div class="comp-card">
        <div class="comp-card-head">
          <span class="comp-industry" style="background:${industryColor}">${c.industry}</span>
          <span class="comp-employees"><i class="ti ti-users"></i> ${c.employees.toLocaleString()}名</span>
        </div>
        <h3 class="comp-card-name">${escapeHtml(c.company_name)}</h3>
        <p class="comp-card-location"><i class="ti ti-map-pin"></i> ${escapeHtml(c.location)}</p>
        <p class="comp-card-desc">${escapeHtml(c.description)}</p>

        <div class="comp-card-stats">
          <div class="comp-stat">
            <span class="comp-stat-label">初任給</span>
            <span class="comp-stat-val">${c.starting_salary}万円</span>
          </div>
          <div class="comp-stat">
            <span class="comp-stat-label">年休</span>
            <span class="comp-stat-val">${c.annual_holidays}日</span>
          </div>
          <div class="comp-stat">
            <span class="comp-stat-label">残業</span>
            <span class="comp-stat-val">月${c.overtime_hours}h</span>
          </div>
          <div class="comp-stat">
            <span class="comp-stat-label">リモート</span>
            <span class="comp-stat-val">${remote}</span>
          </div>
        </div>

        <div class="comp-card-tags">
          ${tags.map(t => `<span class="comp-tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// リセット処理
function resetFilters() {
  Object.values(filters).forEach(f => f.value = '');
  searchCompanies();
}

// XSS対策
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// イベント登録
document.getElementById('searchBtn').addEventListener('click', searchCompanies);
document.getElementById('resetBtn').addEventListener('click', resetFilters);

// 初回ロードで全件取得
searchCompanies();