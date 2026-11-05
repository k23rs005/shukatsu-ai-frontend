// ===== ログインチェック =====
(async function checkAuth() {
  const me = await authMe();
  if (!me || !me.logged_in) {
    window.location.href = 'login.html';
  }
})();

// ===== Dify API設定 =====
const DIFY_API_KEY = 'app-k7iaVxyTD3M0cNN9BEbGuBOu'; // ← DifyのAPIキーに変更
const DIFY_API_URL = 'https://api.dify.ai/v1/chat-messages';

// ===== 状態管理 =====
let conversationId = ''; // DifyがセッションIDを管理
let detectedType   = null;
let studentProfile = {};
let difyUserId = 'student-anonymous';

const studentContextReady = (async function loadStudentContext() {
  const me = await authMe();
  if (me?.logged_in && me.account?.id) {
    setActiveAccountId(me.account.id);
    difyUserId = `student-${me.account.id}`;
  }
  if (me?.logged_in) {
    const data = await getProfile();
    if (data?.profile) studentProfile = data.profile;
  }
})();

const typeKeywords = {
  avoid: ['めんどくさい', 'やる気', 'キャンセル', '登録した', '後で', 'だるい', 'したくない'],
  comm:  ['話せない', 'ES', '面接', '相談', '緊張', '苦手', 'うまく'],
  lost:  ['わからない', '大手', 'とりあえず', '迷う', '絞れない', 'やりたいこと']
};

const PROFILE_PROGRESS_LABELS = {
  not_started: 'まだ始めていない', research: '情報収集中', self_analysis: '自己分析中',
  company_research: '企業・業界を調べている', es: 'ES・応募書類を作成中',
  application: '応募・選考中', interview: '面接中', offer: '内定あり', paused: '就活を一時休止中', other: 'その他'
};
const PROFILE_EXPECTATION_LABELS = {
  motivation: '気持ちの整理', first_step: '何から始めるか', self_analysis: '自己分析',
  company_selection: '企業・業界選び', es_review: 'ES・自己PR', interview_practice: '面接練習',
  work_conditions: '求人票・労働条件', action_plan: '行動計画', other: 'その他'
};

// ===== DOM =====
const messagesEl  = document.getElementById('chatMessages');
const inputEl     = document.getElementById('chatInput');
// ===== 型判定（キーワードベース） =====
function detectType(text) {
  for (const [type, keywords] of Object.entries(typeKeywords)) {
    if (keywords.some(kw => text.includes(kw))) return type;
  }
  return null;
}

// ===== メッセージ表示 =====
function appendMessage(role, text) {
  const row = document.createElement('div');
  row.className = `msg-row ${role === 'user' ? 'msg-row--user' : 'msg-row--ai'}`;

  if (role === 'ai') {
    row.innerHTML = `
      <div class="bubble-avatar"><i class="ti ti-robot"></i></div>
      <div class="bubble bubble--ai">${text.replace(/\n/g, '<br>')}</div>`;
  } else {
    row.innerHTML = `<div class="bubble bubble--user">${text}</div>`;
  }

  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ===== タイピングインジケーター =====
function showTyping() {
  const row = document.createElement('div');
  row.className = 'msg-row msg-row--ai';
  row.id = 'typingRow';
  row.innerHTML = `
    <div class="bubble-avatar"><i class="ti ti-robot"></i></div>
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function hideTyping() {
  document.getElementById('typingRow')?.remove();
}

// ===== Dify API呼び出し =====
async function callDifyAPI(userMessage) {
  await studentContextReady;
  const profileLines = [
    ['学年', studentProfile.school_year], ['興味のある業界', studentProfile.interests],
    ['希望職種', studentProfile.desired_role], ['希望勤務地', studentProfile.desired_location],
    ['強み', studentProfile.strengths], ['これまで力を入れた経験', studentProfile.experience],
    ['仕事選びで大切にしたいこと', studentProfile.work_values],
    ['就活の進捗', PROFILE_PROGRESS_LABELS[studentProfile.progress]],
    ['期待するサポート', (studentProfile.expectation || '').split(',').filter(Boolean)
      .map(value => PROFILE_EXPECTATION_LABELS[value]).filter(Boolean).join('、')]
  ].filter(([, value]) => value?.trim()).map(([label, value]) => `${label}: ${value}`);
  const profileContext = profileLines.length
    ? profileLines.join('\n')
    : 'プロフィール情報は登録されていません。';
  const res = await fetch(DIFY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIFY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: {
        user_type: detectedType || 'unknown', // 型をDifyに渡す
        student_profile: profileContext // プロフィールは相談内容と分けて渡す
      },
      query:           userMessage,
      response_mode:   'blocking',          // 応答が完成してから返す
      conversation_id: conversationId,      // 空文字なら新規会話
      user:            difyUserId
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Dify API error: ${res.status} ${err.message || ''}`);
  }

  const data = await res.json();

  // DifyのconversationIDを保存（次のターンで引き継ぐ）
  if (data.conversation_id) {
    conversationId = data.conversation_id;
  }

  return data.answer || 'ごめん、ちょっとうまく答えられなかった。もう一回聞いてみて！';
}

// ===== メッセージ保存 =====
async function saveMessage(role, content) {
  try {
    await fetch(`${BACKEND_URL}/api/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: getSessionId(), role, content })
    });
  } catch (e) {
    console.warn('メッセージ保存失敗:', e);
  }
}

// ===== 送信処理 =====
async function sendMessage(text) {
  if (!text.trim()) return;
  await studentContextReady;

  // 初回選択肢を非表示
  document.getElementById('initialChoices')?.remove();

  // ユーザーメッセージ表示 + 保存
  appendMessage('user', text);
  saveMessage('user', text);

  // 発言ごとの相談傾向を職員向けに記録する（チャット画面には表示しない）
  detectedType = detectType(text) || detectedType;
  const profileUpdateProposal = detectProfileUpdateProposal(text);

  // タイピング表示
  showTyping();

  try {
    const reply = await callDifyAPI(text);
    hideTyping();
    appendMessage('ai', reply);
    saveMessage('ai', reply);   // ← AI返答も保存
    if (Object.keys(profileUpdateProposal).length) {
      appendProfileUpdateConfirmation(profileUpdateProposal);
    }

    // バックエンドに会話1往復を記録（往復数+1・DifyのconversationID保存）
    if (typeof recordTurn === 'function') {
      recordTurn(conversationId, detectedType || 'unknown');
    }
    // トピックタグを更新
    updateTopicTags(text);
  } catch (err) {
    hideTyping();
    appendMessage('ai', 'ちょっと接続エラーが起きちゃった。もう一度試してみて！');
    console.error(err);
  }
}

function detectProfileUpdateProposal(text) {
  const update = {};
  const progressSignals = [
    ['not_started', /まだ(?:就活を)?始めていない|就活はこれから|就活に未着手/],
    ['paused', /就活を(?:一時)?休止|就活を止めている/],
    ['offer', /内定(?:をもら|が出|があり|済み)/],
    ['interview', /面接(?:中|を受けている|が進んでいる)/],
    ['es', /(?:ES|エントリーシート|応募書類).{0,10}(?:作成中|書いている|作成している|作っています)/],
    ['application', /(?:応募|エントリー)(?:を)?(?:始めた|している|中)|選考中/],
    ['company_research', /(?:企業|業界)(?:研究|を調べている|を見ている)(?:中|しています)?/],
    ['self_analysis', /自己分析(?:中|をしている|しています)/],
    ['research', /情報収集(?:中|をしている|しています)/]
  ];
  const progressMatch = progressSignals.find(([, pattern]) => pattern.test(text));
  if (progressMatch) update.progress = progressMatch[0];

  const support = [];
  const supportSignals = [
    ['motivation', /気持ちの整理|不安を聞いて|話を聞いてほしい|気持ちを相談したい/],
    ['first_step', /何から始め|最初の一歩|就活の始め方/],
    ['self_analysis', /自己分析.{0,12}(?:相談|手伝|一緒に|したい|希望)/],
    ['company_selection', /(?:企業|業界|会社)選び|企業を選ぶ.{0,8}(?:相談|手伝|一緒)/],
    ['es_review', /(?:ES|エントリーシート|自己PR).{0,12}(?:添削|書き方|書けない|相談|手伝|不安|苦手)/],
    ['interview_practice', /面接.{0,12}(?:練習|模擬|対策|相談|手伝|不安|苦手|話せない)/],
    ['work_conditions', /求人票|労働条件|年間休日|残業時間|給与条件/],
    ['action_plan', /行動計画|スケジュール|やること.{0,8}(?:決め|整理|教えて)/]
  ];
  for (const [value, pattern] of supportSignals) {
    if (pattern.test(text)) support.push(value);
  }
  const currentSupport = new Set((studentProfile.expectation || '').split(',').filter(Boolean));
  const addedSupport = support.filter(value => !currentSupport.has(value));
  if (addedSupport.length) update.expectation = [...currentSupport, ...addedSupport].join(',');

  if (update.progress === studentProfile.progress) delete update.progress;
  return update;
}

function appendProfileUpdateConfirmation(proposal) {
  const row = document.createElement('div');
  row.className = 'msg-row msg-row--ai';
  const avatar = document.createElement('div');
  avatar.className = 'bubble-avatar';
  avatar.innerHTML = '<i class="ti ti-robot"></i>';
  const card = document.createElement('section');
  card.className = 'profile-update-card';
  card.setAttribute('aria-label', 'プロフィール更新の確認');

  const title = document.createElement('p');
  title.className = 'profile-update-title';
  title.textContent = 'プロフィールに反映する内容を見つけました。保存しますか？';
  card.appendChild(title);

  if (proposal.progress) {
    const line = document.createElement('p');
    line.textContent = `就活の進捗：${PROFILE_PROGRESS_LABELS[proposal.progress]}`;
    card.appendChild(line);
  }
  if (proposal.expectation) {
    const line = document.createElement('p');
    line.textContent = `期待するサポート：${proposal.expectation.split(',').map(value => PROFILE_EXPECTATION_LABELS[value]).filter(Boolean).join('、')}`;
    card.appendChild(line);
  }

  const actions = document.createElement('div');
  actions.className = 'profile-update-actions';
  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'profile-update-save';
  saveButton.textContent = 'プロフィールに保存';
  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'profile-update-dismiss';
  dismissButton.textContent = '保存しない';
  actions.append(saveButton, dismissButton);
  card.appendChild(actions);
  row.append(avatar, card);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  dismissButton.addEventListener('click', () => row.remove());
  saveButton.addEventListener('click', async () => {
    saveButton.disabled = true;
    dismissButton.disabled = true;
    saveButton.textContent = '保存中...';
    const data = await getProfile();
    if (!data?.profile) {
      saveButton.textContent = '読み込めませんでした。再度お試しください';
      saveButton.disabled = false;
      dismissButton.disabled = false;
      return;
    }
    const result = await saveProfile({ ...data.profile, ...proposal });
    if (result?.status === 'ok') {
      studentProfile = { ...data.profile, ...proposal };
      title.textContent = 'プロフィールに保存しました。次の相談から回答に反映されます。';
      actions.remove();
    } else {
      saveButton.textContent = result?.error || '保存できませんでした。再度お試しください';
      saveButton.disabled = false;
      dismissButton.disabled = false;
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

function handleSend() {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  sendMessage(text);
}

function sendChoice(text) {
  sendMessage(text);
}

// ===== Enterキー送信 =====
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

// ===== トピックタグ自動生成 =====
const TOPIC_KEYWORDS = {
  '面接不安':   ['面接', '緊張', '話せない', '言葉が出ない', 'うまく話せ'],
  'ES悩み':     ['ES', 'エントリーシート', '自己PR', '書けない', '書き方'],
  '業界未定':   ['業界', 'どの業界', '何がしたい', 'やりたいこと', 'わからない'],
  '就活意欲低': ['めんどくさい', 'したくない', 'やる気', 'だるい', '後でいい'],
  '大手志向':   ['大手', '有名企業', '有名な会社', 'ネームバリュー'],
  '情報収集中': ['説明会', 'インターン', 'ナビサイト', 'マイナビ', 'リクナビ'],
  '面接練習':   ['面接練習', '練習したい', '模擬面接', '練習相手'],
};

async function updateTopicTags(userMessage) {
  const matchedTags = [];
  for (const [tag, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(kw => userMessage.includes(kw))) {
      matchedTags.push(tag);
    }
  }
  if (matchedTags.length === 0) return;

  try {
    await fetch(`${BACKEND_URL}/api/turn/tags`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: matchedTags, session_id: getSessionId() })
    });
  } catch (e) {
    console.warn('タグ更新失敗:', e);
  }
}

// ===== 履歴の復元（画面を開いたとき） =====
async function loadHistory() {
  await studentContextReady;
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/messages?session_id=${encodeURIComponent(getSessionId())}`,
      { credentials: 'include' }
    );
    if (!res.ok) return;
    const data = await res.json();
    const history = data.messages || [];

    // Difyの会話IDを復元（続きから文脈を引き継ぐ）
    if (data.dify_conversation_id) {
      conversationId = data.dify_conversation_id;
    }

    if (history.length === 0) return; // 履歴なし → 初期画面のまま

    // 初回選択肢を消して、過去の吹き出しを順に描画
    document.getElementById('initialChoices')?.remove();
    history.forEach(m => appendMessage(m.role, m.content));
  } catch (e) {
    console.warn('履歴の復元に失敗:', e);
  }
}

loadHistory();
