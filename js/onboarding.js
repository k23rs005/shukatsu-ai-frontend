// ===== ステップデータ =====
const STEPS = [
  {
    icon: 'ti-hand-stop',
    label: 'ステップ 1',
    title: 'まず、今の正直な\n気持ちを教えてほしい',
    desc: '就活についてどんな感じ？正直に選んでね。',
    choices: [
      { icon: 'ti-clock-pause', title: 'めんどくさくて後回しにしてる', desc: '登録だけして止まってる、説明会キャンセルしがち', type: 'avoid' },
      { icon: 'ti-message-off', title: 'うまく話せなくて困ってる',   desc: '面接やESが苦手、誰にも相談できない',           type: 'comm' },
      { icon: 'ti-arrows-shuffle', title: '何がしたいかわからない',  desc: '手当たり次第に応募、大手しか見えていない',     type: 'lost' },
    ]
  },
  {
    icon: 'ti-calendar',
    label: 'ステップ 2',
    title: '今、どこまで就活を\n進めてる？',
    desc: '現在の状況を教えて。どれが一番近い？',
    choices: [
      { icon: 'ti-circle-dashed', title: 'ほぼ何もしてない',         desc: '考えてはいるけど、まだ手をつけていない',           type: 'none' },
      { icon: 'ti-list-check',    title: 'サイト登録くらいはした',   desc: 'ナビサイトに登録したが、そこで止まってる',         type: 'start' },
      { icon: 'ti-building',      title: '説明会や選考に進んでいる', desc: 'ESを出したり、面接を受け始めている',               type: 'active' },
    ]
  },
  {
    icon: 'ti-target',
    label: 'ステップ 3',
    title: 'このAIに一番\n期待することは？',
    desc: 'どんなふうにサポートしてほしい？',
    choices: [
      { icon: 'ti-heart',     title: 'まず話を聞いてほしい',             desc: 'アドバイスより、ただ聞いてくれるだけでいい',   type: 'listen' },
      { icon: 'ti-checklist', title: '具体的なやることを教えてほしい',   desc: '何をすればいいか、小さく教えてほしい',         type: 'todo' },
      { icon: 'ti-bulb',      title: '自分に向いてる仕事を見つけたい', desc: '自己分析や企業選びを一緒に考えてほしい',       type: 'career' },
    ]
  }
];

// ===== 型別の結果定義 =====
const RESULTS = {
  avoid: {
    icon: 'ti-clock-pause',
    title: '回避・先延ばし型',
    desc: '「めんどくさい」が口癖でも大丈夫。急かさず、5分でできる小さい一歩から一緒に考えるよ。',
    tags: ['ゆっくりでOK', '小さい一歩から', '急かさない']
  },
  comm: {
    icon: 'ti-message-off',
    title: 'コミュニケーション不全型',
    desc: '話すのが苦手でも全然OK。まず聞き役に徹するから、安心して話してみて。',
    tags: ['まず聞く', '否定しない', '一緒に練習']
  },
  lost: {
    icon: 'ti-arrows-shuffle',
    title: '情報過多・迷走型',
    desc: '情報を増やすんじゃなくて、今あるものを整理しよう。質問しながら一緒に絞っていくよ。',
    tags: ['整理から始める', '大手以外も見てみる', '自分軸を探す']
  }
};

// ===== 状態 =====
let step = 0;
let answers = [];
let selectedIdx = -1;

// ===== DOM参照 =====
const progFill  = document.getElementById('progFill');
const progLabel = document.getElementById('progLabel');
const obBody    = document.getElementById('obBody');
const backBtn   = document.getElementById('backBtn');
const nextBtn   = document.getElementById('nextBtn');

// ===== ドット更新 =====
function updateDots(active) {
  for (let i = 0; i < 4; i++) {
    const d = document.getElementById('dot' + i);
    d.className = 'ob-dot' + (i === active ? ' active' : '');
  }
}

// ===== ステップ描画 =====
function renderStep() {
  const s = STEPS[step];
  const progress = ((step + 1) / (STEPS.length + 1)) * 100;

  progFill.style.width  = progress + '%';
  progLabel.textContent = `${step + 1} / ${STEPS.length}`;
  updateDots(step);

  backBtn.style.visibility = step === 0 ? 'hidden' : 'visible';
  nextBtn.disabled  = true;
  nextBtn.innerHTML = '次へ <i class="ti ti-arrow-right"></i>';

  const titleHtml = s.title.replace(/\n/g, '<br>');

  obBody.innerHTML = `
    <div class="ob-icon"><i class="ti ${s.icon}" aria-hidden="true"></i></div>
    <div class="ob-step-label">${s.label}</div>
    <h2 class="ob-title">${titleHtml}</h2>
    <p class="ob-desc">${s.desc}</p>
    <div class="ob-choices" role="radiogroup" aria-label="${s.title.replace(/\n/g,' ')}">
      ${s.choices.map((c, i) => `
        <div class="ob-choice${selectedIdx === i ? ' selected' : ''}"
             onclick="selectChoice(${i})"
             role="radio"
             aria-checked="${selectedIdx === i}"
             tabindex="0">
          <div class="ob-choice-icon"><i class="ti ${c.icon}" aria-hidden="true"></i></div>
          <div class="ob-choice-text">
            <h4>${c.title}</h4>
            <p>${c.desc}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ===== 結果描画 =====
function renderResult() {
  const type = answers[0] || 'avoid';
  const r    = RESULTS[type] || RESULTS.avoid;

  progFill.style.width  = '100%';
  progLabel.textContent = '完了！';
  updateDots(3);

  backBtn.style.visibility = 'hidden';
  nextBtn.disabled  = false;
  nextBtn.innerHTML = '話しかけてみる <i class="ti ti-arrow-right"></i>';

  obBody.innerHTML = `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:8px 0">
      <div class="result-icon"><i class="ti ${r.icon}" aria-hidden="true"></i></div>
      <h2 class="result-title">${r.title}</h2>
      <p class="result-desc">${r.desc}</p>
      <div class="result-tags">
        ${r.tags.map(t => `<span class="result-tag">${t}</span>`).join('')}
      </div>
    </div>
  `;

  // 型をsessionStorageに保存してチャット画面に引き継ぐ
  sessionStorage.setItem('userType', type);
  sessionStorage.setItem('userTypeLabel', r.title);

  // バックエンド（Flask + MySQL）に保存
  // answers = [型, 進捗, 期待] の順
  if (typeof saveOnboarding === 'function') {
    saveOnboarding(answers[0], answers[1], answers[2]);
  }
}

// ===== 選択処理 =====
function selectChoice(idx) {
  selectedIdx = idx;
  nextBtn.disabled = false;

  // 選択状態を更新（再描画せずDOMだけ更新）
  document.querySelectorAll('.ob-choice').forEach((el, i) => {
    el.classList.toggle('selected', i === idx);
    el.setAttribute('aria-checked', i === idx ? 'true' : 'false');
    el.querySelector('.ob-choice-icon').style.background = i === idx ? 'var(--purple)' : '';
    el.querySelector('.ob-choice-icon i').style.color    = i === idx ? '#fff' : '';
  });
}

// ===== 次へ =====
function nextStep() {
  if (step < STEPS.length) {
    if (selectedIdx >= 0) {
      answers.push(STEPS[step].choices[selectedIdx].type);
    }
    step++;
    selectedIdx = -1;

    if (step === STEPS.length) {
      renderResult();
    } else {
      renderStep();
    }
  } else {
    // 結果画面からチャットへ遷移
    window.location.href = 'chat.html';
  }
}

// ===== 戻る =====
function prevStep() {
  if (step > 0) {
    step--;
    selectedIdx = -1;
    answers.pop();
    renderStep();
  }
}

// ===== キーボード操作 =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !nextBtn.disabled) nextStep();
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    const max = step < STEPS.length ? STEPS[step].choices.length - 1 : -1;
    if (max >= 0) selectChoice(Math.min((selectedIdx < 0 ? 0 : selectedIdx + 1), max));
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    if (selectedIdx > 0) selectChoice(selectedIdx - 1);
  }
});

// ===== 初期描画（ログインチェック後） =====
async function initOnboarding() {
  const me = await authMe();
  if (!me || !me.logged_in) {
    // 未ログインならログイン画面へ
    window.location.href = 'login.html';
    return;
  }
  // ログイン済みならオンボーディング開始
  renderStep();
}

initOnboarding();
