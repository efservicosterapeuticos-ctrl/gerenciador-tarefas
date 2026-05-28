let _notificacoesCache = [];
let _realtimeChannel = null;

async function carregarNotificacoes(userId) {
  const { data } = await sb
    .from('notificacoes')
    .select('*')
    .eq('usuario_id', userId)
    .order('criado_em', { ascending: false })
    .limit(30);
  _notificacoesCache = data || [];
  renderizarNotificacoes(_notificacoesCache);
}

async function criarNotificacao(usuarioId, mensagem) {
  try {
    await sb.from('notificacoes').insert({ usuario_id: usuarioId, mensagem });
  } catch (_) {}
}

async function marcarLida(id) {
  await sb.from('notificacoes').update({ lida: true }).eq('id', id);
  const n = _notificacoesCache.find(n => n.id === id);
  if (n) { n.lida = true; atualizarBadge(); }
}

async function marcarTodasLidas() {
  const sessao = getSessao();
  if (!sessao) return;
  await sb.from('notificacoes')
    .update({ lida: true })
    .eq('usuario_id', sessao.id)
    .eq('lida', false);
  _notificacoesCache.forEach(n => (n.lida = true));
  renderizarNotificacoes(_notificacoesCache);
}

function atualizarBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const count = _notificacoesCache.filter(n => !n.lida).length;
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.classList.toggle('hidden', count === 0);
}

function renderizarNotificacoes(notifs) {
  atualizarBadge();
  const list = document.getElementById('notif-list');
  if (!list) return;
  if (!notifs.length) {
    list.innerHTML = '<p class="notif-empty">Nenhuma notificação ainda.</p>';
    return;
  }
  list.innerHTML = notifs.map(n => `
    <div class="notif-item${n.lida ? '' : ' notif-nao-lida'}" data-id="${n.id}" onclick="notifClicar('${n.id}')">
      ${!n.lida ? '<span class="notif-dot"></span>' : ''}
      <div class="notif-msg">${n.mensagem}</div>
      <div class="notif-data">${relativeTime(n.criado_em)}</div>
    </div>
  `).join('');
}

async function notifClicar(id) {
  const n = _notificacoesCache.find(n => n.id === id);
  if (n && !n.lida) await marcarLida(id);
  const el = document.querySelector(`.notif-item[data-id="${id}"]`);
  if (el) {
    el.classList.remove('notif-nao-lida');
    el.querySelector('.notif-dot')?.remove();
  }
}

function relativeTime(str) {
  if (!str) return '';
  const diff = Math.floor((Date.now() - new Date(str)) / 1000);
  if (diff < 60) return 'Agora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  if (diff < 172800) return 'Ontem';
  return new Date(str).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function iniciarRealtimeNotificacoes(userId) {
  if (_realtimeChannel) _realtimeChannel.unsubscribe();
  _realtimeChannel = sb.channel('notif-' + userId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notificacoes',
      filter: `usuario_id=eq.${userId}`,
    }, (payload) => {
      _notificacoesCache.unshift(payload.new);
      if (_notificacoesCache.length > 30) _notificacoesCache.pop();
      renderizarNotificacoes(_notificacoesCache);
      mostrarToast(payload.new.mensagem);
    })
    .subscribe();
}

function toggleNotifDropdown() {
  const dropdown = document.getElementById('notif-dropdown');
  if (!dropdown) return;
  dropdown.classList.toggle('hidden');
}

document.addEventListener('click', (e) => {
  const wrap = document.getElementById('notif-wrap');
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown && wrap && !wrap.contains(e.target)) {
    dropdown.classList.add('hidden');
  }
});

function mostrarToast(mensagem) {
  const toast = document.createElement('div');
  toast.className = 'notif-toast';
  toast.innerHTML = `<span class="notif-toast-dot"></span><span>${mensagem}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('notif-toast-show'));
  });
  setTimeout(() => {
    toast.classList.remove('notif-toast-show');
    setTimeout(() => toast.remove(), 400);
  }, 4500);
}
