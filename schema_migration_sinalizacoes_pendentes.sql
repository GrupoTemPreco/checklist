-- =============================================================================
-- Migração: sinalizações pendentes (comentário / plano de ação por loja+pergunta)
-- Correr no Supabase SQL Editor (revisão antes em staging).
-- NÃO aplicar automaticamente — executar manualmente.
-- =============================================================================

-- Loja = mesmo valor de public.avaliacoes.unidade (text com o nome da unidade).

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.sinalizacoes_pendentes (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja                            text NOT NULL,
  pergunta_id                     uuid NOT NULL REFERENCES public.perguntas(id),
  tipo_campo                      text NOT NULL
                                    CHECK (tipo_campo IN ('comentario', 'plano_acao')),
  texto_original                  text NOT NULL,
  status                          text NOT NULL DEFAULT 'pendente'
                                    CHECK (status IN ('pendente', 'resolvido')),
  avaliacao_origem_id             uuid NOT NULL REFERENCES public.avaliacoes(id),
  criado_em                       timestamptz NOT NULL DEFAULT now(),
  resolvido_em                    timestamptz,
  avaliacao_resolucao_id          uuid REFERENCES public.avaliacoes(id),
  vezes_nao_resolvido             integer NOT NULL DEFAULT 0,
  historico_motivos_nao           jsonb NOT NULL DEFAULT '[]'::jsonb,
  ultima_verificacao_em           timestamptz,
  ultima_avaliacao_verificacao_id uuid REFERENCES public.avaliacoes(id)
);

COMMENT ON TABLE public.sinalizacoes_pendentes IS
  'Pendências sinalizadas por loja+pergunta+tipo (comentario|plano_acao) entre avaliações.';
COMMENT ON COLUMN public.sinalizacoes_pendentes.loja IS
  'Identificador da loja: mesmo texto de avaliacoes.unidade (nome da unidade).';
COMMENT ON COLUMN public.sinalizacoes_pendentes.historico_motivos_nao IS
  'Array acumulado de { motivo, data, avaliacao_id }; nunca sobrescrever — só acrescentar.';

-- Uma única pendência ativa por loja + pergunta + tipo de campo
CREATE UNIQUE INDEX IF NOT EXISTS sinalizacoes_pendentes_unica_ativa
  ON public.sinalizacoes_pendentes (loja, pergunta_id, tipo_campo)
  WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS sinalizacoes_pendentes_loja_status_idx
  ON public.sinalizacoes_pendentes (loja, status);

ALTER TABLE public.sinalizacoes_pendentes ENABLE ROW LEVEL SECURITY;

-- Policies abertas (mesmo padrão pós schema_migration_sem_auth_profiles.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sinalizacoes_pendentes'
      AND policyname = 'sinalizacoes_leitura_aberta'
  ) THEN
    CREATE POLICY sinalizacoes_leitura_aberta
      ON public.sinalizacoes_pendentes FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sinalizacoes_pendentes'
      AND policyname = 'sinalizacoes_escrita_aberta'
  ) THEN
    CREATE POLICY sinalizacoes_escrita_aberta
      ON public.sinalizacoes_pendentes FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sinalizacoes_pendentes'
      AND policyname = 'sinalizacoes_atualizacao_aberta'
  ) THEN
    CREATE POLICY sinalizacoes_atualizacao_aberta
      ON public.sinalizacoes_pendentes FOR UPDATE USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sinalizacoes_pendentes'
      AND policyname = 'sinalizacoes_apagar_aberta'
  ) THEN
    CREATE POLICY sinalizacoes_apagar_aberta
      ON public.sinalizacoes_pendentes FOR DELETE USING (true);
  END IF;
END $$;

-- Acrescenta motivo ao histórico (concat jsonb) sem sobrescrever o array
CREATE OR REPLACE FUNCTION public.sinalizacao_marcar_nao_resolvido(
  p_loja text,
  p_pergunta_id uuid,
  p_tipo_campo text,
  p_motivo text,
  p_avaliacao_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_tipo_campo NOT IN ('comentario', 'plano_acao') THEN
    RAISE EXCEPTION 'tipo_campo inválido: %', p_tipo_campo;
  END IF;

  UPDATE public.sinalizacoes_pendentes
  SET
    vezes_nao_resolvido = vezes_nao_resolvido + 1,
    historico_motivos_nao = coalesce(historico_motivos_nao, '[]'::jsonb)
      || jsonb_build_array(
        jsonb_build_object(
          'motivo', coalesce(p_motivo, ''),
          'data', now(),
          'avaliacao_id', p_avaliacao_id
        )
      ),
    ultima_verificacao_em = now(),
    ultima_avaliacao_verificacao_id = p_avaliacao_id
  WHERE loja = p_loja
    AND pergunta_id = p_pergunta_id
    AND tipo_campo = p_tipo_campo
    AND status = 'pendente';
END;
$$;

COMMENT ON FUNCTION public.sinalizacao_marcar_nao_resolvido IS
  'Incrementa vezes_nao_resolvido e acrescenta {motivo,data,avaliacao_id} ao histórico jsonb.';

COMMIT;
