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
  return data;
}

async function atualizarStatus(id, status) {
  const { error } = await sb
    .from('tarefas')
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
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

  let resultado = _tarefasCache;
  if (status) resultado = resultado.filter(t => t.status === status);
  if (prioridade) resultado = resultado.filter(t => t.prioridade === prioridade);
  if (usuario) resultado = resultado.filter(t => t.atribuido_a === usuario);

  const isAdmin = getSessao()?.perfil === 'admin';
  renderizarKanban(resultado, _pipelines || _pipelinesKanban, isAdmin);
}
