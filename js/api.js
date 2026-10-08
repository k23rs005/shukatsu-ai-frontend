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
function recordTurn(difyConversationId, userType) {
  return fetch(`${BACKEND_URL}/api/turn`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: getSessionId(),
      dify_conversation_id: difyConversationId || null,
      user_type: userType || 'unknown'
    })
  }).then(async res => {
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }).catch(err => {
    console.warn('[backend] /api/turn 呼び出し失敗:', err.message);
    return null;
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

// ===== 認証系API =====

// 認証APIはcredentialsを含める必要がある（セッションクッキー送信のため）
async function authPost(path, body) {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      credentials: 'include',  // セッションクッキー送信
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const data = await res.json();
    if (!res.ok) {
      return { ...data, status: 'error' };
    }
    return data;
  } catch (err) {
    console.warn(`[auth] ${path} 失敗:`, err.message);
    return { status: 'error', error: '通信エラーが発生しました' };
  }
}

async function authGet(path) {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[auth] ${path} 失敗:`, err.message);
    return null;
  }
}
// ユーザー登録
function authSignup(loginId, nickname, password) {
  return authPost('/api/auth/signup', {
    login_id: loginId,
    nickname: nickname,
    password: password
  });
}

// ログイン
function authLogin(loginId, password) {
  return authPost('/api/auth/login', {
    login_id: loginId,
    password: password
  });
}
// ログアウト
function authLogout() {
  return authPost('/api/auth/logout', {});
}

// 現在のログイン情報取得
function authMe() {
  return authGet('/api/auth/me');
}

function getProfile() {
  return authGet('/api/profile');
}

function saveProfile(profile) {
  return authPut('/api/profile', profile);
}

async function authPut(path, body) {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const data = await res.json();
    return res.ok ? data : { ...data, status: 'error' };
  } catch (err) {
    console.warn(`[auth] ${path} 失敗:`, err.message);
    return { status: 'error', error: '通信エラーが発生しました' };
  }
}
