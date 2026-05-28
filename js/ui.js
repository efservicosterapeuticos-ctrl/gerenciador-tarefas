const STATUS_LABEL = { pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída' };
const PRIORIDADE_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

function renderizarTarefas(tarefas, isAdmin = false) {
  const container = document.getElementById('tasks-container');
  if (!tarefas.length) {
    container.innerHTML = '<p class="empty-state">Nenhuma tarefa encontrada.</p>';
    return;
  }

  container.innerHTML = tarefas.map(t => `
    <div class="task-card prioridade-${t.prioridade}" data-id="${t.id}">
      <div class="task-card-header">
        <span class="task-titulo">${t.titulo}</span>
        <span class="badge badge-${t.prioridade}">${PRIORIDADE_LABEL[t.prioridade]}</span>
      </div>
      ${t.descricao ? `<p class="task-descricao">${t.descricao}</p>` : ''}
      <div class="task-meta">
        <span class="badge badge-${t.status}">${STATUS_LABEL[t.status]}</span>
        <span class="task-pipeline">${t.pipeline?.nome || ''}</span>
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
  `).join('');
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
        <span class="usuario-nome">${u.nome}</span>
        <span class="badge">${u.perfil === 'admin' ? 'Admin' : 'Usuário'}</span>
      </div>
      <div class="usuario-actions">
        <button class="btn btn-sm btn-danger" onclick="confirmarExcluirUsuario('${u.id}')">Remover</button>
      </div>
    </div>
  `).join('');
}
