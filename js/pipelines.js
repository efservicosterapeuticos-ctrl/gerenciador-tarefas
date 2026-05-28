async function getPipelines() {
  const { data, error } = await sb.from('pipelines').select('*').order('prioridade');
  if (error) { console.error(error); return []; }
  return data;
}

async function criarPipeline(nome, prioridade) {
  const sessao = getSessao();
  const { data, error } = await sb
    .from('pipelines')
    .insert({ nome, prioridade, criado_por: sessao.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function editarPipeline(id, nome, prioridade) {
  const { error } = await sb.from('pipelines').update({ nome, prioridade }).eq('id', id);
  if (error) throw error;
}

async function excluirPipeline(id) {
  const { error } = await sb.from('pipelines').delete().eq('id', id);
  if (error) throw error;
}

async function carregarPipelinesNoFiltro(selectId) {
  const pipelines = await getPipelines();
  const select = document.getElementById(selectId);
  pipelines.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.nome;
    select.appendChild(opt);
  });
}
