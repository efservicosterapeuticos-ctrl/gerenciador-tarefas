// ===== ANIMAÇÕES =====
function animarNumero(el, target, duration = 700) {
  let startTime = null;
  const step = (ts) => {
    if (!startTime) startTime = ts;
    const progress = Math.min((ts - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function ativarAnimacoesDashboard() {
  document.querySelectorAll('.stat-number[data-num]').forEach((el, i) => {
    el.classList.add('stat-enter');
    el.style.animationDelay = `${i * 0.08}s`;
    const target = parseInt(el.dataset.num);
    setTimeout(() => animarNumero(el, target), i * 80);
  });
  requestAnimationFrame(() => {
    document.querySelectorAll('.progress-bar[data-w]').forEach(bar => {
      bar.style.width = bar.dataset.w + '%';
    });
  });
}

// ===== DASHBOARD GERAL =====
function renderDashboardGeral(tarefas, usuarios) {
  const container = document.getElementById('dashboard-container');
  if (!container) return;

  const total = tarefas.length;
  const pendentes = tarefas.filter(t => t.status === 'pendente').length;
  const emAndamento = tarefas.filter(t => t.status === 'em_andamento').length;
  const concluidas = tarefas.filter(t => t.status === 'concluida').length;
  const taxaGeral = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  const hoje = new Date().toISOString().split('T')[0];
  const atrasadas = tarefas.filter(t => t.prazo && t.prazo < hoje && t.status !== 'concluida').length;

  const porUsuario = (usuarios || []).map(u => {
    const minhas = tarefas.filter(t => t.atribuido_a === u.id);
    const feitas = minhas.filter(t => t.status === 'concluida').length;
    const taxa = minhas.length > 0 ? Math.round((feitas / minhas.length) * 100) : 0;
    return { ...u, total: minhas.length, feitas, taxa };
  }).filter(u => u.total > 0).sort((a, b) => b.total - a.total);

  container.innerHTML = `
    <div class="dash-stats">
      <div class="stat-card">
        <div class="stat-number" data-num="${total}">0</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card stat-pendente">
        <div class="stat-number" data-num="${pendentes}">0</div>
        <div class="stat-label">A Fazer</div>
      </div>
      <div class="stat-card stat-andamento">
        <div class="stat-number" data-num="${emAndamento}">0</div>
        <div class="stat-label">Em Andamento</div>
      </div>
      <div class="stat-card stat-concluida">
        <div class="stat-number" data-num="${concluidas}">0</div>
        <div class="stat-label">Concluídas</div>
      </div>
      ${atrasadas > 0 ? `
        <div class="stat-card stat-atrasada">
          <div class="stat-number" data-num="${atrasadas}">0</div>
          <div class="stat-label">Atrasadas</div>
        </div>
      ` : ''}
    </div>

    <div class="dash-grid">
      <div class="dash-card">
        <h4 class="dash-card-title">Taxa de Conclusão</h4>
        <div class="taxa-big ${taxaGeral >= 70 ? 'taxa-big-ok' : taxaGeral >= 40 ? 'taxa-big-medio' : 'taxa-big-baixo'}">${taxaGeral}%</div>
        <div class="progress-bar-wrap">
          <div class="progress-bar progress-bar-primary" data-w="${taxaGeral}" style="width:0%"></div>
        </div>
        <p class="dash-sub">${concluidas} de ${total} tarefas concluídas</p>
      </div>

      <div class="dash-card">
        <h4 class="dash-card-title">Progresso por Pessoa</h4>
        ${porUsuario.length === 0 ? '<p class="dash-empty">Nenhuma tarefa atribuída</p>' : ''}
        ${porUsuario.map(u => `
          <div class="dash-row">
            <div class="dash-row-info">
              <span class="dash-row-name">${u.nome}</span>
              <span class="dash-row-count">${u.feitas}/${u.total}</span>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-bar progress-bar-primary" data-w="${u.taxa}" style="width:0%"></div>
            </div>
            <span class="dash-taxa">${u.taxa}%</span>
          </div>
        `).join('')}
      </div>

      <div class="dash-card">
        <h4 class="dash-card-title">Distribuição por Prioridade</h4>
        ${renderGraficoPrioridade(tarefas)}
      </div>

      <div class="dash-card">
        <h4 class="dash-card-title">Distribuição por Status</h4>
        ${renderGraficoStatus(tarefas)}
      </div>
    </div>
  `;

  requestAnimationFrame(() => ativarAnimacoesDashboard());
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
      <div class="dash-row-info"><span class="badge badge-alta">Alta</span><span class="dash-row-count">${alta}</span></div>
      <div class="progress-bar-wrap"><div class="progress-bar" data-w="${pct(alta)}" style="width:0%; background: var(--prioridade-alta)"></div></div>
      <span class="dash-taxa">${pct(alta)}%</span>
    </div>
    <div class="dash-row">
      <div class="dash-row-info"><span class="badge badge-media">Média</span><span class="dash-row-count">${media}</span></div>
      <div class="progress-bar-wrap"><div class="progress-bar" data-w="${pct(media)}" style="width:0%; background: var(--prioridade-media)"></div></div>
      <span class="dash-taxa">${pct(media)}%</span>
    </div>
    <div class="dash-row">
      <div class="dash-row-info"><span class="badge badge-baixa">Baixa</span><span class="dash-row-count">${baixa}</span></div>
      <div class="progress-bar-wrap"><div class="progress-bar" data-w="${pct(baixa)}" style="width:0%; background: var(--prioridade-baixa)"></div></div>
      <span class="dash-taxa">${pct(baixa)}%</span>
    </div>
  `;
}

function renderGraficoStatus(tarefas) {
  const total = tarefas.length;
  if (total === 0) return '<p class="dash-empty">Sem dados</p>';
  const pendente = tarefas.filter(t => t.status === 'pendente').length;
  const emAndamento = tarefas.filter(t => t.status === 'em_andamento').length;
  const concluida = tarefas.filter(t => t.status === 'concluida').length;
  const pct = n => Math.round((n / total) * 100);

  return `
    <div class="dash-row">
      <div class="dash-row-info"><span class="badge badge-pendente">A Fazer</span><span class="dash-row-count">${pendente}</span></div>
      <div class="progress-bar-wrap"><div class="progress-bar" data-w="${pct(pendente)}" style="width:0%; background:#f59e0b"></div></div>
      <span class="dash-taxa">${pct(pendente)}%</span>
    </div>
    <div class="dash-row">
      <div class="dash-row-info"><span class="badge badge-em_andamento">Em Andamento</span><span class="dash-row-count">${emAndamento}</span></div>
      <div class="progress-bar-wrap"><div class="progress-bar" data-w="${pct(emAndamento)}" style="width:0%; background:#3b82f6"></div></div>
      <span class="dash-taxa">${pct(emAndamento)}%</span>
    </div>
    <div class="dash-row">
      <div class="dash-row-info"><span class="badge badge-concluida">Concluído</span><span class="dash-row-count">${concluida}</span></div>
      <div class="progress-bar-wrap"><div class="progress-bar" data-w="${pct(concluida)}" style="width:0%; background:#10b981"></div></div>
      <span class="dash-taxa">${pct(concluida)}%</span>
    </div>
  `;
}
