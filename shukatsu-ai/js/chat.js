// ===== 設定 =====
// Gemini APIキーをここに入れる（本番はサーバーサイドで管理）
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY';
const GEMINI_MODEL = 'gemini-1.5-flash';

// ===== システムプロンプト =====
const SYSTEM_PROMPT = `あなたは「就活問題児の話し相手AI」だ。
タメ口OK、フランクに話す。就活カウンセラーではなく、ちょっと就活に詳しい友達として振る舞う。

## 最重要ルール：必ず質問で終わる
どんな返答も、最後は必ずこちらからの質問1つで締める。
質問なしで終わることは絶対にしない。質問は1つだけ。複数聞かない。

## 就活問題児の3つの型
- 回避・先延ばし型：「めんどくさい」でサイト登録だけして止まってる
- コミュニケーション不全型：ESや面接が苦手で誰にも相談できない
- 情報過多・迷走型：何がしたいかわからず手当たり次第に応募

## 会話のフェーズ
フェーズ1（最初の1〜2往復）：雑談・関係構築。就活と関係ない質問でいい。
フェーズ2（3〜5往復）：就活の現状把握。今どこまでやってるか確認。
フェーズ3（6往復以降）：悩みの核心を1つに絞る。
フェーズ4：核心が特定できたら超小さいアクションを1〜2個提案。それでも最後は質問。

## 絶対禁止
- 就活を急かす（「早くしないと」「もう時間がない」はNG）
- 「なんかあったら声かけてね」で会話を終わらせる
- 選択肢を3つ以上出す
- 長文（3〜4文以内）
- 否定・説教・他者との比較

## 返答フォーマット
1. 相手の発言を1文で受け止める
2. 共感や情報を1〜2文で返す（必要な時だけ）
3. 質問を1つで締める（必須）`;

// ===== 状態管理 =====
let conversationHistory = [];
let detectedType = null;

const typeLabels = {
  'avoidance': '回避・先延ばし型',
  'communication': 'コミュ不全型',
  'overwhelmed': '情報過多・迷走型'
};

const typeKeywords = {
  avoidance: ['めんどくさい', 'やる気', 'キャンセル', '登録した', '後で', 'だるい', 'したくない'],
  communication: ['話せない', 'ES', '面接', '相談', '緊張', '苦手', 'うまく'],
  overwhelmed: ['わからない', '大手', 'とりあえず', '迷う', '絞れない', 'やりたいこと']
};

// ===== DOM =====
const messagesEl = document.getElementById('chatMessages');
const inputEl = document.getElementById('chatInput');
const typeBadgeEl = document.getElementById('typeBadge');

// ===== 型判定 =====
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
  const row = document.getElementById('typingRow');
  if (row) row.remove();
}

// ===== Gemini API呼び出し =====
async function callGeminiAPI(userMessage) {
  conversationHistory.push({ role: 'user', parts: [{ text: userMessage }] });

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: conversationHistory,
    generationConfig: { temperature: 0.8, maxOutputTokens: 300 }
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'ごめん、ちょっとうまく答えられなかった。もう一回聞いてみて！';

  conversationHistory.push({ role: 'model', parts: [{ text: reply }] });
  return reply;
}

// ===== 送信処理 =====
async function sendMessage(text) {
  if (!text.trim()) return;

  // 初回選択肢を非表示
  const initialChoices = document.getElementById('initialChoices');
  if (initialChoices) initialChoices.remove();

  // ユーザーメッセージ表示
  appendMessage('user', text);

  // 型判定
  const type = detectType(text);
  updateTypeBadge(type);

  // タイピング表示
  showTyping();

  try {
    const reply = await callGeminiAPI(text);
    hideTyping();
    appendMessage('ai', reply);
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
