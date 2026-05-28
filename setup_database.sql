-- =============================================
-- GERENCIADOR DE TAREFAS — Setup do banco
-- Cole este SQL no Supabase SQL Editor e execute
-- =============================================

-- Tabela de usuários
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  pin text NOT NULL,
  perfil text NOT NULL DEFAULT 'usuario' CHECK (perfil IN ('admin', 'usuario')),
  criado_em timestamptz DEFAULT now()
);

-- Tabela de pipelines
CREATE TABLE pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('alta', 'media', 'baixa')),
  criado_por uuid REFERENCES users(id) ON DELETE SET NULL,
  criado_em timestamptz DEFAULT now()
);

-- Tabela de tarefas
CREATE TABLE tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  pipeline_id uuid REFERENCES pipelines(id) ON DELETE CASCADE,
  atribuido_a uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida')),
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('alta', 'media', 'baixa')),
  criado_por uuid REFERENCES users(id) ON DELETE SET NULL,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

-- Habilitar acesso público via anon key (projeto interno)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acesso_publico_users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acesso_publico_pipelines" ON pipelines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acesso_publico_tarefas" ON tarefas FOR ALL USING (true) WITH CHECK (true);

-- Usuário admin inicial (PIN: 1234 — troque depois)
INSERT INTO users (nome, pin, perfil) VALUES ('Admin', '1234', 'admin');
