let _tarefasCache = [];
let _usuariosApp = [];
let _realtimeTasksChannel = null;

async function getTarefasTodas() {
  const { data, error } = await sb
    .from('tarefas')
    .select('*, usuario:users!atribuido_a(nome)')
    .order('criado_em', { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
}

async function criarTarefa(payload) {
  const sessao = getSessao();
  const { data, error } = await sb
    .from('tarefas')
    .insert({ ...payload, criado_por: sessao.id })
    .select()
    .single();
  if (error) throw error;
  registrarHistorico(data.id, 'Tarefa criada', `Status inicial: ${payload.status}`);
  if (payload.atribuido_a && payload.atribuido_a !== sessao.id) {
    criarNotificacao(payload.atribuido_a, `Nova tarefa atribuída: "${payload.titulo}"`);
  }
  return data;
}

async function atualizarStatus(id, novoStatus) {
  const labels = { pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída' };
  const { error } = await sb
    .from('tarefas')
    .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  registrarHistorico(id, 'Status alterado', `→ ${labels[novoStatus] || novoStatus}`);

  if (novoStatus === 'concluida') {
    const tarefa = _tarefasCache.find(t => t.id === id);
    if (tarefa?.recorrencia && tarefa.recorrencia !== 'nenhuma') {
      await criarProximaRecorrencia(tarefa);
    }
  }
}

async function editarTarefa(id, payload) {
  const { error } = await sb
    .from('tarefas')
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

async function excluirTarefa(id) {
  const { error } = await sb.from('tarefas').delete().eq('id', id);
  if (error) throw error;
}

async function carregarUsuariosApp() {
  const { data } = await sb.from('users').select('id, nome, perfil, telefone').order('nome');
  _usuariosApp = data || [];
  const selectUser = document.getElementById('filter-usuario');
  if (selectUser && selectUser.options.length <= 1) {
    _usuariosApp.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.nome;
      selectUser.appendChild(opt);
    });
    selectUser.addEventListener('change', () => aplicarFiltros());
  }
}

async function carregarTarefasTodas() {
  const tarefas = await getTarefasTodas();
  _tarefasCache = tarefas;
  renderizarKanban(tarefas);
}

// Mantido para compatibilidade com chamadas existentes
async function carregarTarefasUsuario() {
  await carregarTarefasTodas();
}

async function carregarTarefasAdmin() {
  await carregarTarefasTodas();
}

function aplicarFiltros() {
  const status = document.getElementById('filter-status')?.value;
  const prioridade = document.getElementById('filter-prioridade')?.value;
  const usuario = document.getElementById('filter-usuario')?.value;
  const busca = document.getElementById('search-tarefas')?.value?.trim().toLowerCase();

  let resultado = _tarefasCache;
  if (status) resultado = resultado.filter(t => t.status === status);
  if (prioridade) resultado = resultado.filter(t => t.prioridade === prioridade);
  if (usuario) resultado = resultado.filter(t => t.atribuido_a === usuario);
  if (busca) resultado = resultado.filter(t =>
    t.titulo.toLowerCase().includes(busca) ||
    (t.descricao && t.descricao.toLowerCase().includes(busca))
  );

  renderizarKanban(resultado);
}

function iniciarRealtimeTarefas() {
  if (_realtimeTasksChannel) return;
  _realtimeTasksChannel = sb
    .channel('tarefas-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas' }, async () => {
      if (_isDragging) return;
      await carregarTarefasTodas();
      const dashVisible = document.querySelector('#tab-dashboard:not(.hidden), #view-dashboard:not(.hidden)');
      if (dashVisible) renderDashboardGeral(_tarefasCache, _usuariosApp);
    })
    .subscribe();
}

// ===== HISTÓRICO =====
async function registrarHistorico(tarefaId, acao, detalhe) {
  const sessao = getSessao();
  if (!sessao) return;
  try {
    await sb.from('historico_tarefas').insert({
      tarefa_id: tarefaId,
      usuario_id: sessao.id,
      acao,
      detalhe: detalhe || '',
    });
  } catch (_) { /* tabela pode não existir */ }
}

async function getHistoricoTarefa(tarefaId) {
  try {
    const { data } = await sb
      .from('historico_tarefas')
      .select('*, usuario:users(nome)')
      .eq('tarefa_id', tarefaId)
      .order('criado_em', { ascending: false })
      .limit(15);
    return data || [];
  } catch (_) { return []; }
}

// ===== RECORRÊNCIA =====
async function criarProximaRecorrencia(tarefa) {
  const base = tarefa.prazo ? new Date(tarefa.prazo + 'T12:00:00') : new Date();
  if (tarefa.recorrencia === 'diaria') base.setDate(base.getDate() + 1);
  else if (tarefa.recorrencia === 'semanal') base.setDate(base.getDate() + 7);
  else if (tarefa.recorrencia === 'mensal') base.setMonth(base.getMonth() + 1);

  const novaChecklist = (tarefa.checklist || []).map(i => ({ ...i, concluida: false }));

  await sb.from('tarefas').insert({
    titulo: tarefa.titulo,
    descricao: tarefa.descricao,
    atribuido_a: tarefa.atribuido_a,
    prioridade: tarefa.prioridade,
    status: 'pendente',
    prazo: base.toISOString().split('T')[0],
    recorrencia: tarefa.recorrencia,
    checklist: novaChecklist,
    criado_por: tarefa.criado_por,
  });
}

// ===== WHATSAPP WEBHOOK =====
async function notificarWhatsApp(dadosTarefa) {
  const cfg = JSON.parse(localStorage.getItem('gt-config') || '{}');
  if (!cfg.webhookUrl) return;
  try {
    const url = cfg.webhookToken
      ? `${cfg.webhookUrl}?token=${encodeURIComponent(cfg.webhookToken)}`
      : cfg.webhookUrl;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'nova_tarefa', ...dadosTarefa }),
    });
  } catch (e) {
    console.warn('Notificação WhatsApp falhou:', e.message);
  }
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
  const sessao = getSessao();
  const usuariosOpts = _usuariosApp.map(u =>
    `<option value="${u.id}" ${u.id === sessao?.id ? 'selected' : ''}>${u.nome}${u.id === sessao?.id ? ' (você)' : ''}</option>`
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
      atribuido_a: usuarioId,
      prioridade: document.getElementById('t-prioridade').value,
      status: 'pendente',
      ...(prazoVal && { prazo: prazoVal }),
      ...(recorrenciaVal && recorrenciaVal !== 'nenhuma' && { recorrencia: recorrenciaVal }),
      ...(checklistVal.length > 0 && { checklist: checklistVal }),
    };
    await criarTarefa(payload);
    const usuarioObj = _usuariosApp.find(u => u.id === usuarioId);
    await notificarWhatsApp({
      tarefa: payload.titulo,
      usuario: usuarioObj?.nome || '',
      telefone: usuarioObj?.telefone || '',
      prazo: payload.prazo,
      prioridade: payload.prioridade,
    });
    fecharModal();
    await carregarTarefasTodas();
  });
}

async function abrirModalEditarTarefa(id) {
  const tarefa = _tarefasCache.find(t => t.id === id);
  if (!tarefa) return;

  const checklistExistente = Array.isArray(tarefa.checklist) ? tarefa.checklist : [];
  const sessao = getSessao();

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
        <label>Atribuir a</label>
        <select id="t-usuario" required>
          ${_usuariosApp.map(u => `<option value="${u.id}" ${u.id === tarefa.atribuido_a ? 'selected' : ''}>${u.nome}${u.id === sessao?.id ? ' (você)' : ''}</option>`).join('')}
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
          <option value="pendente" ${tarefa.status === 'pendente' ? 'selected' : ''}>A Fazer</option>
          <option value="em_andamento" ${tarefa.status === 'em_andamento' ? 'selected' : ''}>Em Andamento</option>
          <option value="concluida" ${tarefa.status === 'concluida' ? 'selected' : ''}>Concluído</option>
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
    const novoAtribuido = document.getElementById('t-usuario').value;
    const payload = {
      titulo: document.getElementById('t-titulo').value,
      descricao: document.getElementById('t-descricao').value,
      atribuido_a: novoAtribuido,
      prioridade: document.getElementById('t-prioridade').value,
      status: novoStatus,
    };
    if (prazoEdit || tarefa.prazo !== undefined) payload.prazo = prazoEdit || null;
    if (recorrenciaEdit !== 'nenhuma' || tarefa.recorrencia !== undefined) payload.recorrencia = recorrenciaEdit;
    if (checklistEdit.length > 0 || (tarefa.checklist !== undefined && tarefa.checklist !== null)) payload.checklist = checklistEdit;
    await editarTarefa(id, payload);
    registrarHistorico(id, 'Tarefa editada', '');
    const sessaoEdit = getSessao();
    if (novoAtribuido && novoAtribuido !== tarefa.atribuido_a && novoAtribuido !== sessaoEdit.id) {
      criarNotificacao(novoAtribuido, `Tarefa atribuída a você: "${payload.titulo}"`);
    }
    if (novoStatus === 'concluida' && tarefa.recorrencia && tarefa.recorrencia !== 'nenhuma') {
      await criarProximaRecorrencia({ ...tarefa, ...payload });
    }
    fecharModal();
    await carregarTarefasTodas();
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
    await carregarTarefasTodas();
  });
}
