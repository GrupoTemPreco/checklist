-- Rode no SQL Editor do Supabase se ainda não existirem.
-- 1) Coluna turno em secoes (filtro manhã/tarde)
alter table public.secoes add column if not exists turno text not null default 'manha'
  check (turno in ('manha', 'tarde', 'noite'));

-- Atualizar linhas existentes conforme a tua regra de negócio (ex.: todas manhã até migrares)
-- update public.secoes set turno = 'manha' where true;

-- 2) Tabela unidades
create table if not exists public.unidades (
  id         uuid primary key default uuid_generate_v4(),
  codigo     text not null,
  nome       text not null,
  grupo      text not null default '',
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  unique (codigo)
);

alter table public.unidades enable row level security;

-- Leitura anónima (app checklist sem login via API com service role não precisa disto; útil se usar apenas anon no cliente)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'unidades' and policyname = 'leitura publica unidades para checklist'
  ) then
    create policy "leitura publica unidades para checklist"
      on public.unidades for select
      using (coalesce(ativo, true));
  end if;
end $$;

comment on table public.unidades is 'Lojas/unidades para dropdown do checklist';
