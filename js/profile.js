const profileForm = document.getElementById('profileForm');
const saveMessage = document.getElementById('saveMessage');

async function initProfile() {
  const me = await authMe();
  if (!me?.logged_in) {
    window.location.href = 'login.html';
    return;
  }
  const data = await getProfile();
  if (!data) {
    saveMessage.textContent = 'プロフィールを読み込めませんでした。再読み込みしてください。';
    return;
  }
  const profile = data.profile || {};
  for (const [key, value] of Object.entries(profile)) {
    const field = profileForm.elements.namedItem(key);
    if (field && typeof value === 'string') field.value = value;
  }
}

profileForm.addEventListener('input', () => { saveMessage.textContent = ''; });
profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = profileForm.querySelector('button[type="submit"]');
  button.disabled = true;
  saveMessage.textContent = '保存中...';
  const profile = Object.fromEntries(new FormData(profileForm).entries());
  const result = await saveProfile(profile);
  button.disabled = false;
  if (result?.status === 'ok') {
    saveMessage.textContent = '保存しました。次の相談から回答に反映されます。';
  } else {
    saveMessage.textContent = result?.error || '保存できませんでした。通信状態を確認してください。';
  }
});

initProfile();
