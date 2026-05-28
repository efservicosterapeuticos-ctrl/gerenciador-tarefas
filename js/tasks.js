let _tarefasCache = [];

async function getTarefasUsuario(userId) {
  const { data, error } = await sb
    .from('tarefas')
    .select('*, pipeline:pipelines(nome, prioridade), usuario:users!atribuido_a(nome)')
    .eq('atribuido_a', userId)
    .order('criado_em', { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
}

async function getTarefasTodas() {
  const { data, error } = await sb
    .from('tarefas')
    .select('*, pipeline:pipelines(nome, prioridade), usuario:users!atribuido_a(nome)')
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

async function carregarTarefasUsuario(userId) {
  const [tarefas, pipelines] = await Promise.all([getTarefasUsuario(userId), getPipelines()]);
  _tarefasCache = tarefas;
  renderizarKanban(tarefas, pipelines, false);
}

async function carregarTarefasAdmin() {
  const tarefas = await getTarefasTodas();
  _tarefasCache = tarefas;
  renderizarKanban(tarefas, _pipelines, true);
}

function aplicarFiltros() {
  const status = document.getElementById('filter-status')?.value;
  const prioridade = document.getElementById('filter-prioridade')?.value;
  const usuario = document.getElementById('filter-usuario')?.value;
  const pipeline = document.getElementById('filter-pipeline')?.value;
  const busca = document.getElementById('search-tarefas')?.value?.trim().toLowerCase();

  let resultado = _tarefasCache;
  if (status) resultado = resultado.filter(t => t.status === status);
  if (prioridade) resultado = resultado.filter(t => t.prioridade === prioridade);
  if (usuario) resultado = resultado.filter(t => t.atribuido_a === usuario);
  if (pipeline) resultado = resultado.filter(t => t.pipeline_id === pipeline);
  if (busca) resultado = resultado.filter(t =>
    t.titulo.toLowerCase().includes(busca) ||
    (t.descricao && t.descricao.toLowerCase().includes(busca))
  );

  const isAdmin = getSessao()?.perfil === 'admin';
  renderizarKanban(resultado, _pipelines || _pipelinesKanban, isAdmin);
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
  } catch (_) { /* table may not exist yet */ }
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
    pipeline_id: tarefa.pipeline_id,
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
    await fetch(cfg.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'nova_tarefa', ...dadosTarefa }),
    });
  } catch (e) {
    console.warn('Notificação WhatsApp falhou:', e.message);
  }
}
