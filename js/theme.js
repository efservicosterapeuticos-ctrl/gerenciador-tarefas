// Apply immediately on parse to prevent theme flash
(function () {
  const t = localStorage.getItem('gt-tema') || 'noite';
  document.documentElement.setAttribute('data-theme', t);
})();

function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema);
  localStorage.setItem('gt-tema', tema);
  document.querySelectorAll('.theme-dot').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === tema);
  });
}
