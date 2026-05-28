let _pipelines = [];
let _usuarios = [];

async function iniciarAdmin() {
  await Promise.all([carregarPipelinesAdmin(), carregarUsuariosAdmin()]);
  await carregarTarefasAdmin();

  configurarAbas();
  configurarBotoes();
  configurarFiltrosAdmin();
}

// ===== ABAS =====
function configurarAbas() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.remove('hidden');
    });
  });
}

// ===== BOTÕES =====
function configurarBotoes() {
  document.getElementById('btn-nova-tarefa').addEventListener('click', abrirModalNovaTarefa);
  document.getElementById('btn-novo-pipeline').addEventListener('click', abrirModalNovoPipeline);
  document.getElementById('btn-novo-usuario').addEventListener('click', abrirModalNovoUsuario);
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

// ===== MODAIS — TAREFAS =====
function abrirModalNovaTarefa() {
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
          <option value="">Selecione...</option>
          ${_usuarios.map(u => `<option value="${u.id}">${u.nome}</option>`).join('')}
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
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Criar Tarefa</button>
      </div>
    </form>
  `);

  document.getElementById('form-tarefa').addEventListener('submit', async (e) => {
    e.preventDefault();
    await criarTarefa({
      titulo: document.getElementById('t-titulo').value,
      descricao: document.getElementById('t-descricao').value,
      pipeline_id: document.getElementById('t-pipeline').value,
      atribuido_a: document.getElementById('t-usuario').value,
      prioridade: document.getElementById('t-prioridade').value,
      status: 'pendente',
    });
    fecharModal();
    await carregarTarefasAdmin();
  });
}

async function abrirModalEditarTarefa(id) {
  const tarefa = _tarefasCache.find(t => t.id === id);
  if (!tarefa) return;

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
          ${_usuarios.map(u => `<option value="${u.id}" ${u.id === tarefa.atribuido_a ? 'selected' : ''}>${u.nome}</option>`).join('')}
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
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar</button>
      </div>
    </form>
  `);

  document.getElementById('form-editar-tarefa').addEventListener('submit', async (e) => {
    e.preventDefault();
    await editarTarefa(id, {
      titulo: document.getElementById('t-titulo').value,
      descricao: document.getElementById('t-descricao').value,
      pipeline_id: document.getElementById('t-pipeline').value,
      atribuido_a: document.getElementById('t-usuario').value,
      prioridade: document.getElementById('t-prioridade').value,
      status: document.getElementById('t-status').value,
    });
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
