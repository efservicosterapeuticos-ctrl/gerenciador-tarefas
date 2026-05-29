const STATUS_LABEL = { pendente: 'A Fazer', em_andamento: 'Em Andamento', concluida: 'Concluído' };
const STATUS_COLS = [
  { key: 'pendente',     label: 'A Fazer',      cls: 'col-pendente'  },
  { key: 'em_andamento', label: 'Em Andamento',  cls: 'col-andamento' },
  { key: 'concluida',    label: 'Concluído',     cls: 'col-concluida' },
];
const PRIORIDADE_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const RECORRENCIA_LABEL = { diaria: '↻ Diária', semanal: '↻ Semanal', mensal: '↻ Mensal' };

let _isDragging = false;

function formatarData(dataStr) {
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

function renderizarKanban(tarefas) {
  const container = document.getElementById('tasks-container');
  container.className = 'kanban-board';

  container.innerHTML = STATUS_COLS.map(col => {
    const tarefasColuna = tarefas.filter(t => t.status === col.key);
    return `
      <div class="kanban-column ${col.cls}">
        <div class="kanban-column-header">
          <div class="kanban-column-title"><span>${col.label}</span></div>
          <span class="kanban-count">${tarefasColuna.length}</span>
        </div>
        <div class="kanban-cards" data-status="${col.key}">
          ${tarefasColuna.map(t => renderCardKanban(t)).join('')}
          ${tarefasColuna.length === 0 ? '<div class="kanban-empty">Sem tarefas</div>' : ''}
        </div>
      </div>
    `;
  }).join('');

  inicializarDragDrop();

  let delay = 0;
  container.querySelectorAll('.task-card').forEach(card => {
    card.classList.add('card-enter');
    card.style.animationDelay = `${delay}s`;
    delay += 0.045;
  });
}

function renderCardKanban(t) {
  const hoje = new Date().toISOString().split('T')[0];
  const atrasada = t.prazo && t.prazo < hoje && t.status !== 'concluida';
  const prazoHoje = t.prazo && t.prazo === hoje && t.status !== 'concluida';

  const checklist = Array.isArray(t.checklist) ? t.checklist : [];
  const checkTotal = checklist.length;
  const checkFeitos = checklist.filter(i => i.concluida).length;
  const checkPct = checkTotal > 0 ? Math.round((checkFeitos / checkTotal) * 100) : 0;

  return `
    <div class="task-card prioridade-${t.prioridade}${atrasada ? ' atrasada' : ''}" data-id="${t.id}">
      <div class="task-card-header">
        <span class="task-titulo">${t.titulo}</span>
        <span class="badge badge-${t.prioridade}">${PRIORIDADE_LABEL[t.prioridade]}</span>
      </div>
      ${t.descricao ? `<p class="task-descricao">${t.descricao}</p>` : ''}
      <div class="task-meta">
        ${atrasada ? `<span class="badge badge-atrasada">Atrasada</span>` : ''}
        ${t.usuario ? `<span class="task-pipeline">👤 ${t.usuario.nome}</span>` : ''}
        ${t.prazo ? `<span class="task-prazo ${atrasada ? 'prazo-atrasado' : prazoHoje ? 'prazo-hoje' : ''}">📅 ${formatarData(t.prazo)}</span>` : ''}
        ${t.recorrencia && t.recorrencia !== 'nenhuma' ? `<span class="badge badge-recorrente">${RECORRENCIA_LABEL[t.recorrencia] || t.recorrencia}</span>` : ''}
      </div>
      ${checkTotal > 0 ? `
        <div class="checklist-wrap">
          ${checklist.slice(0, 3).map((item, i) => `
            <label class="checklist-item ${item.concluida ? 'concluida' : ''}">
              <input type="checkbox" ${item.concluida ? 'checked' : ''} onchange="toggleCheckItem('${t.id}', ${i}, this.checked)" />
              <span>${item.texto}</span>
            </label>
          `).join('')}
          ${checkTotal > 3 ? `<span class="checklist-label">+${checkTotal - 3} mais itens</span>` : ''}
        </div>
        <div class="checklist-progress-bar">
          <div class="checklist-progress-fill" style="width: ${checkPct}%"></div>
        </div>
        <span class="checklist-label">${checkFeitos}/${checkTotal} itens concluídos</span>
      ` : ''}
      <div class="task-actions">
        <button class="btn btn-sm btn-outline" onclick="abrirModalEditarTarefa('${t.id}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="confirmarExcluirTarefa('${t.id}')">Excluir</button>
      </div>
    </div>
  `;
}

async function toggleCheckItem(tarefaId, itemIndex, concluida) {
  const tarefa = _tarefasCache.find(t => t.id === tarefaId);
  if (!tarefa || !Array.isArray(tarefa.checklist)) return;

  const novoChecklist = tarefa.checklist.map((it, i) =>
    i === itemIndex ? { ...it, concluida } : it
  );

  await editarTarefa(tarefaId, { checklist: novoChecklist });
  tarefa.checklist = novoChecklist;

  const card = document.querySelector(`.task-card[data-id="${tarefaId}"]`);
  if (card) {
    const feitos = novoChecklist.filter(i => i.concluida).length;
    const total = novoChecklist.length;
    const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;
    const fill = card.querySelector('.checklist-progress-fill');
    const label = card.querySelector('.checklist-label');
    if (fill) fill.style.width = `${pct}%`;
    if (label) label.textContent = `${feitos}/${total} itens concluídos`;
    const item = card.querySelectorAll('.checklist-item')[itemIndex];
    if (item) item.classList.toggle('concluida', concluida);
  }
}

function inicializarDragDrop() {
  document.querySelectorAll('.kanban-cards').forEach(col => {
    Sortable.create(col, {
      group: 'kanban',
      animation: 150,
      ghostClass: 'task-card-ghost',
      chosenClass: 'task-card-chosen',
      dragClass: 'task-card-drag',
      onStart: () => { _isDragging = true; },
      onEnd: async (evt) => {
        _isDragging = false;
        const taskId = evt.item.dataset.id;
        const novoStatus = evt.to.dataset.status;
        const antigoStatus = evt.from.dataset.status;
        if (novoStatus !== antigoStatus) {
          await atualizarStatus(taskId, novoStatus);
          const task = _tarefasCache.find(t => t.id === taskId);
          if (task) task.status = novoStatus;
          atualizarContadores();
        }
      }
    });
  });
}

function atualizarContadores() {
  document.querySelectorAll('.kanban-column').forEach(col => {
    const cards = col.querySelectorAll('.task-card').length;
    col.querySelector('.kanban-count').textContent = cards;
    const emptyEl = col.querySelector('.kanban-empty');
    if (cards > 0 && emptyEl) emptyEl.remove();
    if (cards === 0 && !emptyEl) {
      col.querySelector('.kanban-cards').insertAdjacentHTML('beforeend', '<div class="kanban-empty">Sem tarefas</div>');
    }
  });
}

async function mudarStatus(id, novoStatus) {
  await atualizarStatus(id, novoStatus);
  await carregarTarefasTodas();
}

function abrirModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function fecharModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

document.addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') fecharModal();
});

function renderizarUsuarios(usuarios) {
  const container = document.getElementById('usuarios-container');
  if (!container) return;
  if (!usuarios.length) {
    container.innerHTML = '<p class="empty-state">Nenhum usuário cadastrado.</p>';
    return;
  }
  container.innerHTML = usuarios.map(u => `
    <div class="usuario-item" data-id="${u.id}">
      <div class="usuario-info">
        <div class="usuario-avatar">${u.nome.charAt(0).toUpperCase()}</div>
        <div>
          <div class="usuario-nome">${u.nome}</div>
          <div class="usuario-meta">
            <span class="badge badge-perfil-${u.perfil}">${u.perfil === 'admin' ? 'Admin' : 'Usuário'}</span>
          </div>
        </div>
      </div>
      <div class="usuario-actions">
        <button class="btn btn-sm btn-outline" onclick="abrirModalEditarUsuario('${u.id}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="confirmarExcluirUsuario('${u.id}')">Remover</button>
      </div>
    </div>
  `).join('');
}
