// ===== DASHBOARD ADMIN =====
function renderDashboardAdmin(tarefas, usuarios, pipelines) {
  const container = document.getElementById('dashboard-container');

  const total = tarefas.length;
  const pendentes = tarefas.filter(t => t.status === 'pendente').length;
  const emAndamento = tarefas.filter(t => t.status === 'em_andamento').length;
  const concluidas = tarefas.filter(t => t.status === 'concluida').length;
  const taxaGeral = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  const porUsuario = usuarios.map(u => {
    const minhas = tarefas.filter(t => t.atribuido_a === u.id);
    const feitas = minhas.filter(t => t.status === 'concluida').length;
    const taxa = minhas.length > 0 ? Math.round((feitas / minhas.length) * 100) : 0;
    return { ...u, total: minhas.length, feitas, taxa };
  }).filter(u => u.total > 0).sort((a, b) => b.total - a.total);

  const porPipeline = pipelines.map(p => {
    const tasks = tarefas.filter(t => t.pipeline_id === p.id);
    const feitas = tasks.filter(t => t.status === 'concluida').length;
    const taxa = tasks.length > 0 ? Math.round((feitas / tasks.length) * 100) : 0;
    return { ...p, total: tasks.length, feitas, taxa };
  }).filter(p => p.total > 0).sort((a, b) => b.total - a.total);

  const maxPipeline = porPipeline.length > 0 ? porPipeline[0].total : 1;

  container.innerHTML = `
    <div class="dash-stats">
      <div class="stat-card">
        <div class="stat-number">${total}</div>
        <div class="stat-label">Total de Tarefas</div>
      </div>
      <div class="stat-card stat-pendente">
        <div class="stat-number">${pendentes}</div>
        <div class="stat-label">Pendentes</div>
      </div>
      <div class="stat-card stat-andamento">
        <div class="stat-number">${emAndamento}</div>
        <div class="stat-label">Em Andamento</div>
      </div>
      <div class="stat-card stat-concluida">
        <div class="stat-number">${concluidas}</div>
        <div class="stat-label">Concluídas</div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="dash-card">
        <h4 class="dash-card-title">Taxa de Conclusão Geral</h4>
        <div class="taxa-big">${taxaGeral}%</div>
        <div class="progress-bar-wrap">
          <div class="progress-bar progress-bar-primary" style="width: ${taxaGeral}%"></div>
        </div>
        <p class="dash-sub">${concluidas} de ${total} tarefas concluídas</p>
      </div>

      <div class="dash-card">
        <h4 class="dash-card-title">Progresso por Usuário</h4>
        ${porUsuario.length === 0 ? '<p class="dash-empty">Nenhuma tarefa atribuída</p>' : ''}
        ${porUsuario.map(u => `
          <div class="dash-row">
            <div class="dash-row-info">
              <span class="dash-row-name">${u.nome}</span>
              <span class="dash-row-count">${u.feitas}/${u.total}</span>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-bar progress-bar-primary" style="width: ${u.taxa}%"></div>
            </div>
            <span class="dash-taxa">${u.taxa}%</span>
          </div>
        `).join('')}
      </div>

      <div class="dash-card">
        <h4 class="dash-card-title">Tarefas por Pipeline</h4>
        ${porPipeline.length === 0 ? '<p class="dash-empty">Nenhuma tarefa em pipelines</p>' : ''}
        ${porPipeline.map(p => `
          <div class="dash-row">
            <div class="dash-row-info">
              <span class="dash-row-name">${p.nome}</span>
              <span class="badge badge-${p.prioridade}">${PRIORIDADE_LABEL[p.prioridade]}</span>
              <span class="dash-row-count">${p.total}</span>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-bar progress-bar-pipeline" style="width: ${Math.round((p.total / maxPipeline) * 100)}%"></div>
            </div>
            <span class="dash-taxa">${p.taxa}% concluído</span>
          </div>
        `).join('')}
      </div>

      <div class="dash-card">
        <h4 class="dash-card-title">Distribuição por Prioridade</h4>
        ${renderGraficoPrioridade(tarefas)}
      </div>
    </div>
  `;
}

function renderGraficoPrioridade(tarefas) {
  const total = tarefas.length;
  if (total === 0) return '<p class="dash-empty">Sem dados</p>';
  const alta = tarefas.filter(t => t.prioridade === 'alta').length;
  const media = tarefas.filter(t => t.prioridade === 'media').length;
  const baixa = tarefas.filter(t => t.prioridade === 'baixa').length;
  const pct = n => Math.round((n / total) * 100);

  return `
    <div class="dash-row">
      <div class="dash-row-info">
        <span class="badge badge-alta">Alta</span>
        <span class="dash-row-count">${alta}</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar" style="width:${pct(alta)}%; background: var(--prioridade-alta)"></div>
      </div>
      <span class="dash-taxa">${pct(alta)}%</span>
    </div>
    <div class="dash-row">
      <div class="dash-row-info">
        <span class="badge badge-media">Média</span>
        <span class="dash-row-count">${media}</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar" style="width:${pct(media)}%; background: var(--prioridade-media)"></div>
      </div>
      <span class="dash-taxa">${pct(media)}%</span>
    </div>
    <div class="dash-row">
      <div class="dash-row-info">
        <span class="badge badge-baixa">Baixa</span>
        <span class="dash-row-count">${baixa}</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar" style="width:${pct(baixa)}%; background: var(--prioridade-baixa)"></div>
      </div>
      <span class="dash-taxa">${pct(baixa)}%</span>
    </div>
  `;
}

// ===== DASHBOARD INDIVIDUAL =====
function renderDashboardUsuario(tarefas, nomeUsuario) {
  const container = document.getElementById('dashboard-container');

  const total = tarefas.length;
  const pendentes = tarefas.filter(t => t.status === 'pendente').length;
  const emAndamento = tarefas.filter(t => t.status === 'em_andamento').length;
  const concluidas = tarefas.filter(t => t.status === 'concluida').length;
  const taxa = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  const proximas = tarefas
    .filter(t => t.status === 'pendente')
    .sort((a, b) => {
      const ordem = { alta: 0, media: 1, baixa: 2 };
      return ordem[a.prioridade] - ordem[b.prioridade];
    })
    .slice(0, 5);

  container.innerHTML = `
    <div class="dash-welcome">Olá, <strong>${nomeUsuario}</strong> 👋</div>

    <div class="dash-stats">
      <div class="stat-card">
        <div class="stat-number">${total}</div>
        <div class="stat-label">Minhas Tarefas</div>
      </div>
      <div class="stat-card stat-pendente">
        <div class="stat-number">${pendentes}</div>
        <div class="stat-label">Pendentes</div>
      </div>
      <div class="stat-card stat-andamento">
        <div class="stat-number">${emAndamento}</div>
        <div class="stat-label">Em Andamento</div>
      </div>
      <div class="stat-card stat-concluida">
        <div class="stat-number">${concluidas}</div>
        <div class="stat-label">Concluídas</div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="dash-card">
        <h4 class="dash-card-title">Minha Taxa de Conclusão</h4>
        <div class="taxa-big taxa-big-${taxa >= 70 ? 'ok' : taxa >= 40 ? 'medio' : 'baixo'}">${taxa}%</div>
        <div class="progress-bar-wrap progress-bar-wrap-lg">
          <div class="progress-bar progress-bar-primary" style="width: ${taxa}%"></div>
        </div>
        <p class="dash-sub">${concluidas} de ${total} tarefas concluídas</p>
      </div>

      <div class="dash-card">
        <h4 class="dash-card-title">Próximas Pendentes</h4>
        ${proximas.length === 0
          ? '<p class="dash-empty">Nenhuma tarefa pendente 🎉</p>'
          : proximas.map(t => `
            <div class="dash-tarefa-item">
              <span class="badge badge-${t.prioridade}">${PRIORIDADE_LABEL[t.prioridade]}</span>
              <div class="dash-tarefa-info">
                <span class="dash-tarefa-titulo">${t.titulo}</span>
                <span class="dash-tarefa-pipeline">${t.pipeline?.nome || ''}</span>
              </div>
            </div>
          `).join('')
        }
      </div>
    </div>
  `;
}
