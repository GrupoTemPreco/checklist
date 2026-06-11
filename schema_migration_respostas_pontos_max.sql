-- Migração: coluna pontos_max em respostas (snapshot do máximo da pergunta na hora da resposta).
-- Executar no Supabase: SQL Editor → New query → colar e Run.
-- (Se a coluna já existir no projeto, o ALTER falha — pode ignorar ou usar IF NOT EXISTS via DO block.)

alter table public.respostas
  add column if not exists pontos_max int not null default 0;

comment on column public.respostas.pontos_max is
  'pontos_max da pergunta no momento em que a resposta foi gravada; preserva histórico se a pergunta mudar depois.';
