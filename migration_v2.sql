-- Migration v2 — execute no Supabase SQL Editor

-- 1. Due dates
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS prazo date;

-- 2. Checklist (JSON array of {texto, concluida})
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS checklist jsonb DEFAULT '[]';

-- 3. Recurrence
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS recorrencia text
  CHECK (recorrencia IN ('nenhuma', 'diaria', 'semanal', 'mensal'))
  DEFAULT 'nenhuma';

-- 4. Historical log
CREATE TABLE IF NOT EXISTS historico_tarefas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id   uuid REFERENCES tarefas(id) ON DELETE CASCADE,
  usuario_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  acao        text NOT NULL,
  detalhe     text DEFAULT '',
  criado_em   timestamptz DEFAULT now()
);

ALTER TABLE historico_tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "public access historico"
  ON historico_tarefas FOR ALL
  USING (true) WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_historico_tarefa ON historico_tarefas(tarefa_id);
