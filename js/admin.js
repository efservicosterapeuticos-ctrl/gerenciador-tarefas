let _pipelines = [];
let _usuarios = [];

async function iniciarAdmin() {
  await Promise.all([carregarPipelinesAdmin(), carregarUsuariosAdmin()]);
  await carregarTarefasAdmin();
  configurarAbas();
  configurarBotoes();
  configurarFiltrosAdmin();
}

const TAB_TITLES = { dashboard: 'Dashboard', tarefas: 'Tarefas', pipelines: 'Pipelines', usuarios: 'Usuários' };

// ===== ABAS =====
function configurarAbas() {
  document.querySelectorAll('.nav-item[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-item[data-tab]').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.add('hidden');
        c.classList.remove('tab-animate');
      });
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      const tabEl = document.getElementById(`tab-${tabName}`);
      tabEl.classList.remove('hidden');
      requestAnimationFrame(() => tabEl.classList.add('tab-animate'));

      document.getElementById('topbar-title').textContent = TAB_TITLES[tabName] || tabName;

      // Fecha sidebar no mobile ao trocar de aba
      if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('sidebar-open');
        const ov = document.getElementById('sidebar-overlay');
        if (ov) ov.classList.remove('active');
      }

      // Controla visibilidade da faixa de filtros apenas no desktop
      if (window.innerWidth > 768) {
        const topbarActions = document.getElementById('topbar-actions');
        const oculto = topbarActions.classList.contains('filters-ocultos');
        if (!oculto) {
          Array.from(topbarActions.children).forEach(child => {
            child.style.display = tabName === 'tarefas' ? '' : 'none';
          });
        }
      }

      if (tabName === 'dashboard') renderDashboardAdmin(_tarefasCache, _usuarios, _pipelines);
    });
  });
}

// ===== BOTÕES =====
function configurarBotoes() {
  document.getElementById('btn-nova-tarefa').addEventListener('click', abrirModalNovaTarefa);
  document.getElementById('btn-novo-pipeline').addEventListener('click', abrirModalNovoPipeline);
  document.getElementById('btn-novo-usuario').addEventListener('click', abrirModalNovoUsuario);
  document.getElementById('btn-exportar-pdf').addEventListener('click', () => window.print());
}

function configurarFiltrosAdmin() {
  _usuarios.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = u.nome;
    document.getElementById('filter-usuario').appendChild(opt);
  });

  _pipelines.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.nome;
    document.getElementById('filter-pipeline').appendChild(opt);
  });

  ['filter-pipeline', 'filter-usuario', 'filter-status'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => aplicarFiltros());
  });

  document.getElementById('search-tarefas').addEventListener('input', () => aplicarFiltros());
}

// ===== CARREGAR DADOS =====
async function carregarPipelinesAdmin() {
  _pipelines = await getPipelines();
  renderizarPipelines(_pipelines);
}

async function carregarUsuariosAdmin() {
  const { data } = await sb.from('users').select('id, nome, perfil').order('nome');
  _usuarios = data || [];
  renderizarUsuarios(_usuarios);
}

// ===== CHECKLIST HELPERS =====
function adicionarItemChecklist(texto = '') {
  const container = document.getElementById('checklist-items');
  const row = document.createElement('div');
  row.className = 'modal-checklist-row';
  row.innerHTML = `
    <input type="text" placeholder="Descreva o item..." value="${texto}" />
    <button type="button" class="btn-rm-item" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(row);
  row.querySelector('input').focus();
}

function coletarChecklist(preservarEstado = false, checklistExistente = []) {
  const rows = document.querySelectorAll('#checklist-items .modal-checklist-row');
  return Array.from(rows).map((row, i) => {
    const texto = row.querySelector('input[type="text"]').value.trim();
    const concluida = preservarEstado && checklistExistente[i]?.concluida === true;
    return texto ? { texto, concluida } : null;
  }).filter(Boolean);
}

// ===== MODAIS — TAREFAS =====
function abrirModalNovaTarefa() {
  const sessaoAtual = getSessao();
  const usuariosOpts = _usuarios.map(u =>
    `<option value="${u.id}" ${u.id === sessaoAtual?.id ? 'selected' : ''}>${u.nome}${u.id === sessaoAtual?.id ? ' (você)' : ''}</option>`
  ).join('');

  abrirModal(`
    <h3>Nova Tarefa</h3>
    <form id="form-tarefa">
      <div class="form-group">
        <label>Título</label>
        <input type="text" id="t-titulo" required />
      </div>
      <div class="form-group">
        <label>Descrição</label>
        <textarea id="t-descricao"></textarea>
      </div>
      <div class="form-group">
        <label>Pipeline</label>
        <select id="t-pipeline" required>
          <option value="">Selecione...</option>
          ${_pipelines.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Atribuir a</label>
        <select id="t-usuario" required>
          ${usuariosOpts}
        </select>
      </div>
      <div class="form-group">
        <label>Prioridade</label>
        <select id="t-prioridade" required>
          <option value="alta">Alta</option>
          <option value="media" selected>Média</option>
          <option value="baixa">Baixa</option>
        </select>
      </div>
      <div class="form-group">
        <label>Prazo</label>
        <input type="date" id="t-prazo" />
      </div>
      <div class="form-group">
        <label>Recorrência</label>
        <select id="t-recorrencia">
          <option value="nenhuma">Sem recorrência</option>
          <option value="diaria">Diária</option>
          <option value="semanal">Semanal</option>
          <option value="mensal">Mensal</option>
        </select>
      </div>
      <div class="form-group">
        <label>Checklist</label>
        <div id="checklist-items"></div>
        <button type="button" class="btn btn-sm btn-outline" style="margin-top:4px" onclick="adicionarItemChecklist()">+ Adicionar item</button>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Criar Tarefa</button>
      </div>
    </form>
  `);

  document.getElementById('form-tarefa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuarioId = document.getElementById('t-usuario').value;
    const prazoVal = document.getElementById('t-prazo').value;
    const recorrenciaVal = document.getElementById('t-recorrencia').value;
    const checklistVal = coletarChecklist();
    const payload = {
      titulo: document.getElementById('t-titulo').value,
      descricao: document.getElementById('t-descricao').value,
      pipeline_id: document.getElementById('t-pipeline').value,
      atribuido_a: usuarioId,
      prioridade: document.getElementById('t-prioridade').value,
      status: 'pendente',
      ...(prazoVal && { prazo: prazoVal }),
      ...(recorrenciaVal && recorrenciaVal !== 'nenhuma' && { recorrencia: recorrenciaVal }),
      ...(checklistVal.length > 0 && { checklist: checklistVal }),
    };
    const novaTarefa = await criarTarefa(payload);
    const nomeUsuario = _usuarios.find(u => u.id === usuarioId)?.nome || '';
    await notificarWhatsApp({
      tarefa: payload.titulo,
      usuario: nomeUsuario,
      prazo: payload.prazo,
      prioridade: payload.prioridade,
    });
    fecharModal();
    await carregarTarefasAdmin();
  });
}

async function abrirModalEditarTarefa(id) {
  const tarefa = _tarefasCache.find(t => t.id === id);
  if (!tarefa) return;

  const checklistExistente = Array.isArray(tarefa.checklist) ? tarefa.checklist : [];
  const sessaoAdmin = getSessao();

  abrirModal(`
    <h3>Editar Tarefa</h3>
    <form id="form-editar-tarefa">
      <div class="form-group">
        <label>Título</label>
        <input type="text" id="t-titulo" value="${tarefa.titulo}" required />
      </div>
      <div class="form-group">
        <label>Descrição</label>
        <textarea id="t-descricao">${tarefa.descricao || ''}</textarea>
      </div>
      <div class="form-group">
        <label>Pipeline</label>
        <select id="t-pipeline" required>
          ${_pipelines.map(p => `<option value="${p.id}" ${p.id === tarefa.pipeline_id ? 'selected' : ''}>${p.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Atribuir a</label>
        <select id="t-usuario" required>
          ${_usuarios.map(u => `<option value="${u.id}" ${u.id === tarefa.atribuido_a ? 'selected' : ''}>${u.nome}${u.id === sessaoAdmin?.id ? ' (você)' : ''}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Prioridade</label>
        <select id="t-prioridade" required>
          <option value="alta" ${tarefa.prioridade === 'alta' ? 'selected' : ''}>Alta</option>
          <option value="media" ${tarefa.prioridade === 'media' ? 'selected' : ''}>Média</option>
          <option value="baixa" ${tarefa.prioridade === 'baixa' ? 'selected' : ''}>Baixa</option>
        </select>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="t-status" required>
          <option value="pendente" ${tarefa.status === 'pendente' ? 'selected' : ''}>Pendente</option>
          <option value="em_andamento" ${tarefa.status === 'em_andamento' ? 'selected' : ''}>Em andamento</option>
          <option value="concluida" ${tarefa.status === 'concluida' ? 'selected' : ''}>Concluída</option>
        </select>
      </div>
      <div class="form-group">
        <label>Prazo</label>
        <input type="date" id="t-prazo" value="${tarefa.prazo || ''}" />
      </div>
      <div class="form-group">
        <label>Recorrência</label>
        <select id="t-recorrencia">
          <option value="nenhuma" ${!tarefa.recorrencia || tarefa.recorrencia === 'nenhuma' ? 'selected' : ''}>Sem recorrência</option>
          <option value="diaria" ${tarefa.recorrencia === 'diaria' ? 'selected' : ''}>Diária</option>
          <option value="semanal" ${tarefa.recorrencia === 'semanal' ? 'selected' : ''}>Semanal</option>
          <option value="mensal" ${tarefa.recorrencia === 'mensal' ? 'selected' : ''}>Mensal</option>
        </select>
      </div>
      <div class="form-group">
        <label>Checklist</label>
        <div id="checklist-items">
          ${checklistExistente.map(item => `
            <div class="modal-checklist-row">
              <input type="text" value="${item.texto}" />
              <button type="button" class="btn-rm-item" onclick="this.parentElement.remove()">×</button>
            </div>
          `).join('')}
        </div>
        <button type="button" class="btn btn-sm btn-outline" style="margin-top:4px" onclick="adicionarItemChecklist()">+ Adicionar item</button>
      </div>
      <details class="historico-wrap">
        <summary>Histórico de alterações</summary>
        <div class="historico-list" id="historico-container">
          <p class="loading">Carregando...</p>
        </div>
      </details>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar</button>
      </div>
    </form>
  `);

  // Load history asynchronously
  getHistoricoTarefa(id).then(historico => {
    const container = document.getElementById('historico-container');
    if (!container) return;
    if (!historico.length) {
      container.innerHTML = '<p class="dash-empty">Sem registros ainda.</p>';
      return;
    }
    container.innerHTML = historico.map(h => `
      <div class="historico-item">
        <div class="historico-acao">${h.acao} <span class="historico-detalhe">${h.detalhe || ''}</span></div>
        <div class="historico-data">${h.usuario?.nome || ''} · ${new Date(h.criado_em).toLocaleString('pt-BR')}</div>
      </div>
    `).join('');
  });

  document.getElementById('form-editar-tarefa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const novoStatus = document.getElementById('t-status').value;
    const prazoEdit = document.getElementById('t-prazo').value;
    const recorrenciaEdit = document.getElementById('t-recorrencia').value;
    const checklistEdit = coletarChecklist(true, checklistExistente);
    const payload = {
      titulo: document.getElementById('t-titulo').value,
      descricao: document.getElementById('t-descricao').value,
      pipeline_id: document.getElementById('t-pipeline').value,
      atribuido_a: document.getElementById('t-usuario').value,
      prioridade: document.getElementById('t-prioridade').value,
      status: novoStatus,
    };
    // Only include new columns when migration has been run (avoids PGRST204)
    if (prazoEdit || tarefa.prazo !== undefined) payload.prazo = prazoEdit || null;
    if (recorrenciaEdit !== 'nenhuma' || tarefa.recorrencia !== undefined) payload.recorrencia = recorrenciaEdit;
    if (checklistEdit.length > 0 || (tarefa.checklist !== undefined && tarefa.checklist !== null)) payload.checklist = checklistEdit;
    await editarTarefa(id, payload);
    registrarHistorico(id, 'Tarefa editada', '');
    const sessaoEdit = getSessao();
    const novoAtribuido = document.getElementById('t-usuario').value;
    if (novoAtribuido && novoAtribuido !== tarefa.atribuido_a && novoAtribuido !== sessaoEdit.id) {
      criarNotificacao(novoAtribuido, `Tarefa atribuída a você: "${payload.titulo}"`);
    }
    if (novoStatus === 'concluida' && tarefa.recorrencia && tarefa.recorrencia !== 'nenhuma') {
      await criarProximaRecorrencia({ ...tarefa, ...payload });
    }
    fecharModal();
    await carregarTarefasAdmin();
  });
}

async function confirmarExcluirTarefa(id) {
  abrirModal(`
    <h3>Excluir Tarefa</h3>
    <p>Tem certeza que deseja excluir esta tarefa?</p>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-danger" id="btn-confirmar-excluir">Excluir</button>
    </div>
  `);
  document.getElementById('btn-confirmar-excluir').addEventListener('click', async () => {
    await excluirTarefa(id);
    fecharModal();
    await carregarTarefasAdmin();
  });
}

// ===== MODAIS — PIPELINES =====
function abrirModalNovoPipeline() {
  abrirModal(`
    <h3>Novo Pipeline</h3>
    <form id="form-pipeline">
      <div class="form-group">
        <label>Nome</label>
        <input type="text" id="p-nome" required />
      </div>
      <div class="form-group">
        <label>Prioridade</label>
        <select id="p-prioridade">
          <option value="alta">Alta</option>
          <option value="media" selected>Média</option>
          <option value="baixa">Baixa</option>
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Criar</button>
      </div>
    </form>
  `);
  document.getElementById('form-pipeline').addEventListener('submit', async (e) => {
    e.preventDefault();
    await criarPipeline(
      document.getElementById('p-nome').value,
      document.getElementById('p-prioridade').value
    );
    fecharModal();
    await carregarPipelinesAdmin();
  });
}

async function abrirModalEditarPipeline(id) {
  const pipeline = _pipelines.find(p => p.id === id);
  if (!pipeline) return;

  abrirModal(`
    <h3>Editar Pipeline</h3>
    <form id="form-editar-pipeline">
      <div class="form-group">
        <label>Nome</label>
        <input type="text" id="p-nome" value="${pipeline.nome}" required />
      </div>
      <div class="form-group">
        <label>Prioridade</label>
        <select id="p-prioridade">
          <option value="alta" ${pipeline.prioridade === 'alta' ? 'selected' : ''}>Alta</option>
          <option value="media" ${pipeline.prioridade === 'media' ? 'selected' : ''}>Média</option>
          <option value="baixa" ${pipeline.prioridade === 'baixa' ? 'selected' : ''}>Baixa</option>
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar</button>
      </div>
    </form>
  `);
  document.getElementById('form-editar-pipeline').addEventListener('submit', async (e) => {
    e.preventDefault();
    await editarPipeline(
      id,
      document.getElementById('p-nome').value,
      document.getElementById('p-prioridade').value
    );
    fecharModal();
    await carregarPipelinesAdmin();
  });
}

async function confirmarExcluirPipeline(id) {
  abrirModal(`
    <h3>Excluir Pipeline</h3>
    <p>Todas as tarefas deste pipeline também serão excluídas. Confirma?</p>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-danger" id="btn-confirmar-excluir">Excluir</button>
    </div>
  `);
  document.getElementById('btn-confirmar-excluir').addEventListener('click', async () => {
    await excluirPipeline(id);
    fecharModal();
    await carregarPipelinesAdmin();
  });
}

// ===== MODAIS — USUÁRIOS =====
function abrirModalNovoUsuario() {
  abrirModal(`
    <h3>Novo Usuário</h3>
    <form id="form-usuario">
      <div class="form-group">
        <label>Nome</label>
        <input type="text" id="u-nome" required />
      </div>
      <div class="form-group">
        <label>PIN (4 a 6 dígitos)</label>
        <input type="password" id="u-pin" minlength="4" maxlength="6" inputmode="numeric" pattern="[0-9]*" required />
      </div>
      <div class="form-group">
        <label>Perfil</label>
        <select id="u-perfil">
          <option value="usuario">Usuário</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Criar</button>
      </div>
    </form>
  `);
  document.getElementById('form-usuario').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await sb.from('users').insert({
      nome: document.getElementById('u-nome').value,
      pin: document.getElementById('u-pin').value,
      perfil: document.getElementById('u-perfil').value,
    });
    if (error) { alert('Erro ao criar usuário: ' + error.message); return; }
    fecharModal();
    await carregarUsuariosAdmin();
  });
}

async function abrirModalEditarUsuario(id) {
  const usuario = _usuarios.find(u => u.id === id);
  if (!usuario) return;

  abrirModal(`
    <h3>Editar Usuário</h3>
    <form id="form-editar-usuario">
      <div class="form-group">
        <label>Nome</label>
        <input type="text" id="u-nome" value="${usuario.nome}" required />
      </div>
      <div class="form-group">
        <label>Perfil</label>
        <select id="u-perfil">
          <option value="usuario" ${usuario.perfil === 'usuario' ? 'selected' : ''}>Usuário</option>
          <option value="admin" ${usuario.perfil === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </div>
      <div class="form-group">
        <label>Novo PIN (deixe em branco para não alterar)</label>
        <input type="password" id="u-pin" minlength="4" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="••••••" />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar</button>
      </div>
    </form>
  `);

  document.getElementById('form-editar-usuario').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      nome: document.getElementById('u-nome').value,
      perfil: document.getElementById('u-perfil').value,
    };
    const novoPin = document.getElementById('u-pin').value;
    if (novoPin) payload.pin = novoPin;

    const { error } = await sb.from('users').update(payload).eq('id', id);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    fecharModal();
    await carregarUsuariosAdmin();
  });
}

async function confirmarExcluirUsuario(id) {
  abrirModal(`
    <h3>Remover Usuário</h3>
    <p>Tem certeza que deseja remover este usuário?</p>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-danger" id="btn-confirmar-excluir">Remover</button>
    </div>
  `);
  document.getElementById('btn-confirmar-excluir').addEventListener('click', async () => {
    await sb.from('users').delete().eq('id', id);
    fecharModal();
    await carregarUsuariosAdmin();
  });
}

// ===== CONFIGURAÇÕES =====
function abrirConfiguracoesAdmin() {
  const cfg = JSON.parse(localStorage.getItem('gt-config') || '{}');
  abrirModal(`
    <h3>Configurações</h3>
    <div class="form-group">
      <label>Webhook WhatsApp (URL)</label>
      <input type="url" id="cfg-webhook" value="${cfg.webhookUrl || ''}" placeholder="https://seu-bot.com/webhook" />
      <small style="display:block; margin-top:4px; font-size:0.75rem; color:var(--text-muted);">
        Quando uma tarefa é criada, o sistema envia um POST com os dados para este endpoint.
      </small>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarConfiguracoes()">Salvar</button>
    </div>
  `);
}

function salvarConfiguracoes() {
  const webhookUrl = document.getElementById('cfg-webhook').value.trim();
  localStorage.setItem('gt-config', JSON.stringify({ webhookUrl }));
  fecharModal();
}
