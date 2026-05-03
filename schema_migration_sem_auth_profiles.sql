-- =============================================================================
-- Migração: checklist sem Auth / sem tabela profiles
-- Correr no Supabase SQL Editor (revisão antes em staging).
--
-- ORDEM (obrigatória): políticas sobre avaliacoes.usuario_id bloqueiam ALTER.
-- Policies em respostas referem public.avaliacoes (usuario_id) — remover antes
-- do ALTER mesmo que oficialmente tratadas no passo seguinte ao de avaliacoes.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1 — Remover TODAS as políticas em public.avaliacoes (nomes não importam)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avaliacoes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.avaliacoes', pol.policyname);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2 — Remover TODAS as políticas em public.respostas (dependem de usuario_id via join)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'respostas'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.respostas', pol.policyname);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3 — FK para profiles — só depois de não haver policy a usar a coluna
-- ---------------------------------------------------------------------------
ALTER TABLE public.avaliacoes
  DROP CONSTRAINT IF EXISTS avaliacoes_usuario_id_fkey;

-- ---------------------------------------------------------------------------
-- 4 — usuario_id passa a text (nome da pessoa; UUIDs antigos como texto bruto)
-- ---------------------------------------------------------------------------
ALTER TABLE public.avaliacoes
  ALTER COLUMN usuario_id TYPE text USING usuario_id::text;

ALTER TABLE public.avaliacoes
  ALTER COLUMN usuario_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 5 — Novas políticas abertas: avaliacoes
-- ---------------------------------------------------------------------------
CREATE POLICY avaliacoes_leitura_aberta
  ON public.avaliacoes FOR SELECT USING (true);

CREATE POLICY avaliacoes_escrita_aberta
  ON public.avaliacoes FOR INSERT WITH CHECK (true);

CREATE POLICY avaliacoes_atualizacao_aberta
  ON public.avaliacoes FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY avaliacoes_apagar_aberta
  ON public.avaliacoes FOR DELETE USING (true);

-- ---------------------------------------------------------------------------
-- 6 — Novas políticas abertas: respostas
-- ---------------------------------------------------------------------------
CREATE POLICY respostas_leitura_aberta
  ON public.respostas FOR SELECT USING (true);

CREATE POLICY respostas_escrita_aberta
  ON public.respostas FOR INSERT WITH CHECK (true);

CREATE POLICY respostas_atualizacao_aberta
  ON public.respostas FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY respostas_apagar_aberta
  ON public.respostas FOR DELETE USING (true);

-- ---------------------------------------------------------------------------
-- 7 — perguntas, secoes, profiles (policies que citam profiles) + DROP profiles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin edita perguntas" ON public.perguntas;
DROP POLICY IF EXISTS "admin edita secoes" ON public.secoes;

DROP POLICY IF EXISTS "usuario ve proprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "admin ve todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "admin atualiza perfis" ON public.profiles;

DROP TABLE IF EXISTS public.profiles CASCADE;

COMMIT;

-- Segurança: leitura/escrita abertas em avaliacoes/respostas expõem linhas à role
-- que usar o cliente anon se o RLS estiver ativo. Em produção prefere APIs com
-- service_role ou políticas mais restritivas.
