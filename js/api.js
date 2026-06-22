// ===== バックエンドAPI共通設定 =====
// 常に本番のRenderバックエンドに送信
const BACKEND_URL = 'https://shukatsu-backend-3d93.onrender.com';
// ===== session_id の管理 =====
// 初回アクセス時にランダムなIDを生成してlocalStorageに保存
function getSessionId() {
  let sid = localStorage.getItem('sessionId');
  if (!sid) {
    sid = 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('sessionId', sid);
  }
  return sid;
}

// ===== 汎用API呼び出し =====
async function apiPost(path, body) {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    // バックエンドが起動していなくてもフロントは止めない
    console.warn(`[backend] ${path} 呼び出し失敗:`, err.message);
    return null;
  }
}

async function apiGet(path) {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[backend] ${path} 取得失敗:`, err.message);
    return null;
  }
}

// ===== 保存系ヘルパー =====

// オンボーディング結果を保存
function saveOnboarding(userType, progress, expectation) {
  return apiPost('/api/onboarding', {
    session_id:  getSessionId(),
    user_type:   userType   || 'unknown',
    progress:    progress   || 'unknown',
    expectation: expectation || 'unknown'
  });
}

// 会話1往復を記録
function recordTurn(difyConversationId) {
  return apiPost('/api/turn', {
    session_id:           getSessionId(),
    dify_conversation_id: difyConversationId || null
  });
}

// 感想を投稿
function postReview(nickname, content, userType) {
  return apiPost('/api/reviews', {
    nickname,
    content,
    user_type: userType || 'unknown'
  });
}
