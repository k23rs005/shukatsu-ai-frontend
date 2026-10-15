const companyBackLink = document.querySelector('.comp-back');
if (companyBackLink && new URLSearchParams(window.location.search).get('return') === 'chat') {
  companyBackLink.href = 'chat.html';
  companyBackLink.setAttribute('aria-label', 'チャットに戻る');
}

document.querySelectorAll('[data-student-logout]').forEach(button => {
  button.addEventListener('click', async () => {
    button.disabled = true;
    const result = await authLogout();
    if (result?.status === 'ok') {
      window.location.href = '../index.html';
      return;
    }

    button.disabled = false;
    alert('ログアウトに失敗しました。通信状態を確認して、もう一度お試しください。');
  });
});
