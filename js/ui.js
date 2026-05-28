const STATUS_LABEL = { pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída' };
const PRIORIDADE_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

let _pipelinesKanban = [];

function renderizarKanban(tarefas, pipelines, isAdmin = false) {
  _pipelinesKanban = pipelines;
  const container = document.getElementById('tasks-container');
  container.className = 'kanban-board';

  if (!pipelines.length) {
    container.innerHTML = '<p class="empty-state">Nenhum pipeline criado. Crie um pipeline primeiro.</p>';
    return;
  }

  container.innerHTML = pipelines.map(p => {
    const tarefasColuna = tarefas.filter(t => t.pipeline_id === p.id);
    return `
      <div class="kanban-column">
        <div class="kanban-column-header prioridade-header-${p.prioridade}">
          <div class="kanban-column-title">
            <span>${p.nome}</span>
            <span class="badge badge-${p.prioridade}">${PRIORIDADE_LABEL[p.prioridade]}</span>
          </div>
          <span class="kanban-count">${tarefasColuna.length}</span>
        </div>
        <div class="kanban-cards" data-pipeline-id="${p.id}">
          ${tarefasColuna.map(t => renderCardKanban(t, isAdmin)).join('')}
          ${tarefasColuna.length === 0 ? '<div class="kanban-empty">Sem tarefas</div>' : ''}
        </div>
      </div>
    `;
  }).join('');

  if (isAdmin) inicializarDragDrop();
}

function renderCardKanban(t, isAdmin) {
  return `
    <div class="task-card prioridade-${t.prioridade}" data-id="${t.id}">
      <div class="task-card-header">
        <span class="task-titulo">${t.titulo}</span>
        <span class="badge badge-${t.prioridade}">${PRIORIDADE_LABEL[t.prioridade]}</span>
      </div>
      ${t.descricao ? `<p class="task-descricao">${t.descricao}</p>` : ''}
      <div class="task-meta">
        <span class="badge badge-${t.status}">${STATUS_LABEL[t.status]}</span>
        ${isAdmin && t.usuario ? `<span class="task-pipeline">👤 ${t.usuario.nome}</span>` : ''}
      </div>
      <div class="task-actions">
        ${!isAdmin ? renderBotoesStatus(t) : ''}
        ${isAdmin ? `
          <button class="btn btn-sm btn-outline" onclick="abrirModalEditarTarefa('${t.id}')">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="confirmarExcluirTarefa('${t.id}')">Excluir</button>
        ` : ''}
      </div>
    </div>
  `;
}

function inicializarDragDrop() {
  document.querySelectorAll('.kanban-cards').forEach(col => {
    Sortable.create(col, {
      group: 'kanban',
      animation: 150,
      ghostClass: 'task-card-ghost',
      chosenClass: 'task-card-chosen',
      dragClass: 'task-card-drag',
      onEnd: async (evt) => {
        const taskId = evt.item.dataset.id;
        const novoPipelineId = evt.to.dataset.pipelineId;
        const antigoPipelineId = evt.from.dataset.pipelineId;
        if (novoPipelineId !== antigoPipelineId) {
          await editarTarefa(taskId, { pipeline_id: novoPipelineId });
          const task = _tarefasCache.find(t => t.id === taskId);
          if (task) {
            task.pipeline_id = novoPipelineId;
            const novoPipeline = _pipelinesKanban.find(p => p.id === novoPipelineId);
            if (novoPipeline) task.pipeline = { nome: novoPipeline.nome, prioridade: novoPipeline.prioridade };
          }
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

function renderBotoesStatus(tarefa) {
  const proximos = { pendente: 'em_andamento', em_andamento: 'concluida' };
  const label = { em_andamento: 'Iniciar', concluida: 'Concluir' };
  const proximo = proximos[tarefa.status];
  if (!proximo) return '<span class="badge badge-concluida">Concluída ✓</span>';
  return `<button class="btn btn-sm btn-primary" onclick="mudarStatus('${tarefa.id}', '${proximo}')">${label[proximo]}</button>`;
}

async function mudarStatus(id, novoStatus) {
  await atualizarStatus(id, novoStatus);
  const sessao = getSessao();
  await carregarTarefasUsuario(sessao.id);
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

function renderizarPipelines(pipelines) {
  const container = document.getElementById('pipelines-container');
  if (!pipelines.length) {
    container.innerHTML = '<p class="empty-state">Nenhum pipeline criado.</p>';
    return;
  }
  container.innerHTML = pipelines.map(p => `
    <div class="pipeline-item" data-id="${p.id}">
      <div class="pipeline-info">
        <span class="pipeline-nome">${p.nome}</span>
        <span class="badge badge-${p.prioridade}">${PRIORIDADE_LABEL[p.prioridade]}</span>
      </div>
      <div class="pipeline-actions">
        <button class="btn btn-sm btn-outline" onclick="abrirModalEditarPipeline('${p.id}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="confirmarExcluirPipeline('${p.id}')">Excluir</button>
      </div>
    </div>
  `).join('');
}

function renderizarUsuarios(usuarios) {
  const container = document.getElementById('usuarios-container');
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
