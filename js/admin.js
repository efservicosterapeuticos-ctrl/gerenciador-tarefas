let _usuarios = [];

async function iniciarAdmin() {
  await carregarUsuariosAdmin();
  await carregarTarefasAdmin();
  configurarAbas();
  configurarBotoes();
  configurarFiltrosAdmin();
  iniciarRealtimeTarefas();
}

const TAB_TITLES = { dashboard: 'Dashboard', tarefas: 'Tarefas', usuarios: 'Usuários' };

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

      if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('sidebar-open');
        const ov = document.getElementById('sidebar-overlay');
        if (ov) ov.classList.remove('active');
      }

      if (window.innerWidth > 768) {
        const topbarActions = document.getElementById('topbar-actions');
        const oculto = topbarActions.classList.contains('filters-ocultos');
        if (!oculto) {
          Array.from(topbarActions.children).forEach(child => {
            child.style.display = tabName === 'tarefas' ? '' : 'none';
          });
        }
      }

      if (tabName === 'dashboard') renderDashboardGeral(_tarefasCache, _usuarios);
    });
  });
}

// ===== BOTÕES =====
function configurarBotoes() {
  document.getElementById('btn-nova-tarefa').addEventListener('click', abrirModalNovaTarefa);
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

  ['filter-usuario', 'filter-status'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => aplicarFiltros());
  });

  document.getElementById('search-tarefas').addEventListener('input', () => aplicarFiltros());
}

// ===== CARREGAR DADOS =====
async function carregarUsuariosAdmin() {
  const { data } = await sb.from('users').select('id, nome, perfil, telefone').order('nome');
  _usuarios = data || [];
  _usuariosApp = _usuarios;
  renderizarUsuarios(_usuarios);
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
      <div class="form-group">
        <label>Telefone WhatsApp</label>
        <input type="tel" id="u-telefone" placeholder="5585999991111" />
        <small style="color:var(--text-muted);font-size:0.72rem">Código do país + DDD + número (ex: 5585999991111)</small>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Criar</button>
      </div>
    </form>
  `);
  document.getElementById('form-usuario').addEventListener('submit', async (e) => {
    e.preventDefault();
    const telefoneVal = document.getElementById('u-telefone').value.trim();
    const { error } = await sb.from('users').insert({
      nome: document.getElementById('u-nome').value,
      pin: document.getElementById('u-pin').value,
      perfil: document.getElementById('u-perfil').value,
      ...(telefoneVal && { telefone: telefoneVal }),
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
        <label>Telefone WhatsApp</label>
        <input type="tel" id="u-telefone" value="${usuario.telefone || ''}" placeholder="5585999991111" />
        <small style="color:var(--text-muted);font-size:0.72rem">Código do país + DDD + número (ex: 5585999991111)</small>
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
      telefone: document.getElementById('u-telefone').value.trim() || null,
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
      <label>URL do Bot WhatsApp</label>
      <input type="url" id="cfg-webhook" value="${cfg.webhookUrl || ''}" placeholder="https://seu-bot.up.railway.app/webhook" />
      <small style="display:block;margin-top:4px;font-size:0.72rem;color:var(--text-muted)">
        Endereço do servidor bot. Quando uma tarefa é criada, o sistema faz um POST para este endpoint.
      </small>
    </div>
    <div class="form-group">
      <label>Token secreto</label>
      <input type="text" id="cfg-token" value="${cfg.webhookToken || ''}" placeholder="troque-por-algo-secreto" />
      <small style="display:block;margin-top:4px;font-size:0.72rem;color:var(--text-muted)">
        Deve ser igual ao <code>WEBHOOK_TOKEN</code> definido no arquivo <code>.env</code> do bot.
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
  const webhookToken = document.getElementById('cfg-token').value.trim();
  localStorage.setItem('gt-config', JSON.stringify({ webhookUrl, webhookToken }));
  fecharModal();
}
