document.querySelectorAll('[data-student-logout]').forEach(button => {
  button.addEventListener('click', async () => {
    button.disabled = true;
    const result = await authLogout();
    if (result?.status === 'ok') {
      window.location.href = 'login.html';
      return;
    }

    button.disabled = false;
    alert('ログアウトに失敗しました。通信状態を確認して、もう一度お試しください。');
  });
});
