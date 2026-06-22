// ===== Dify API設定 =====
const DIFY_API_KEY = 'app-k7iaVxyTD3M0cNN9BEbGuBOu'; // ← DifyのAPIキーに変更
const DIFY_API_URL = 'https://api.dify.ai/v1/chat-messages';

// ===== 状態管理 =====
let conversationId = ''; // DifyがセッションIDを管理
let detectedType   = null;

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
      query:           userMessage,
      response_mode:   'blocking',          // 応答が完成してから返す
      conversation_id: conversationId,      // 空文字なら新規会話
      user:            'user-001'
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

// ===== 送信処理 =====
async function sendMessage(text) {
  if (!text.trim()) return;

  // 初回選択肢を非表示
  document.getElementById('initialChoices')?.remove();

  // ユーザーメッセージ表示
  appendMessage('user', text);

  // キーワードで型を判定してバッジ更新
  updateTypeBadge(detectType(text));

  // タイピング表示
  showTyping();

  try {
    const reply = await callDifyAPI(text);
    hideTyping();
    appendMessage('ai', reply);

    // バックエンドに会話1往復を記録（往復数+1・DifyのconversationID保存）
    if (typeof recordTurn === 'function') {
      recordTurn(conversationId);
    }
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
