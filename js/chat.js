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
  if (me?.logged_in && me.account?.id) difyUserId = `student-${me.account.id}`;
  if (me?.logged_in) {
    const data = await getProfile();
    if (data?.profile) studentProfile = data.profile;
  }
})();

const typeLabels = {
  avoid: '回避・先延ばし型',
  comm:  'コミュ不全型',
  lost:  '情報過多・迷走型'
};

const typeKeywords = {
  avoid: ['めんどくさい', 'やる気', 'キャンセル', '登録した', '後で', 'だるい', 'したくない'],
  comm:  ['話せない', 'ES', '面接', '相談', '緊張', '苦手', 'うまく'],
  lost:  ['わからない', '大手', 'とりあえず', '迷う', '絞れない', 'やりたいこと']
};

// ===== DOM =====
const messagesEl  = document.getElementById('chatMessages');
const inputEl     = document.getElementById('chatInput');
const typeBadgeEl = document.getElementById('typeBadge');

// ===== オンボーディング結果を反映 =====
const savedType = sessionStorage.getItem('userType');
if (savedType && typeLabels[savedType]) {
  detectedType = savedType;
  typeBadgeEl.textContent = typeLabels[savedType];
  typeBadgeEl.style.display = 'inline-block';
}

// ===== 型判定（キーワードベース） =====
function detectType(text) {
  for (const [type, keywords] of Object.entries(typeKeywords)) {
    if (keywords.some(kw => text.includes(kw))) return type;
  }
  return null;
}

function updateTypeBadge(type) {
  if (!detectedType && type) {
    detectedType = type;
    typeBadgeEl.textContent = typeLabels[type];
    typeBadgeEl.style.display = 'inline-block';
  }
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
    ['仕事選びで大切にしたいこと', studentProfile.work_values]
  ].filter(([, value]) => value?.trim()).map(([label, value]) => `${label}: ${value}`);
  const contextualQuery = profileLines.length
    ? `【相談者プロフィール】\n${profileLines.join('\n')}\n\nこのプロフィールを踏まえ、本人の経験や希望に沿って具体的に回答してください。情報が足りない場合は決めつけず質問してください。\n\n【相談内容】\n${userMessage}`
    : userMessage;
  const res = await fetch(DIFY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIFY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: {
        user_type: detectedType || 'unknown' // 型をDifyに渡す
      },
      query:           contextualQuery,
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

  // 初回選択肢を非表示
  document.getElementById('initialChoices')?.remove();

  // ユーザーメッセージ表示 + 保存
  appendMessage('user', text);
  saveMessage('user', text);

  // キーワードで型を判定してバッジ更新
  updateTypeBadge(detectType(text));

  // タイピング表示
  showTyping();

  try {
    const reply = await callDifyAPI(text);
    hideTyping();
    appendMessage('ai', reply);
    saveMessage('ai', reply);   // ← AI返答も保存

    // バックエンドに会話1往復を記録（往復数+1・DifyのconversationID保存）
    if (typeof recordTurn === 'function') {
      recordTurn(conversationId);
    }
    // トピックタグを更新
    updateTopicTags(text);
  } catch (err) {
    hideTyping();
    appendMessage('ai', 'ちょっと接続エラーが起きちゃった。もう一度試してみて！');
    console.error(err);
  }
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
