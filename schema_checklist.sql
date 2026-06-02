-- ============================================================
-- CHECKLIST ULTRA POPULAR — Schema Supabase
-- ============================================================

-- Extensão para UUID
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- 1. PERFIS DE USUÁRIO
-- Complementa a tabela auth.users do Supabase
-- ------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text not null,
  perfil        text not null default 'gerente'
                  check (perfil in ('gerente', 'supervisor', 'admin')),
  pode_ver_analise boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on column public.profiles.pode_ver_analise is
  'Admin pode ligar/desligar acesso ao dashboard pra qualquer perfil';

-- RLS: cada usuário vê apenas o próprio perfil; admin vê todos
alter table public.profiles enable row level security;

create policy "usuario ve proprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "admin ve todos os perfis"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.perfil = 'admin'
    )
  );

create policy "admin atualiza perfis"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.perfil = 'admin'
    )
  );

-- ------------------------------------------------------------
-- 2. SEÇÕES DO QUESTIONÁRIO
-- ------------------------------------------------------------
create table public.secoes (
  id          uuid primary key default uuid_generate_v4(),
  ordem       int  not null,
  titulo      text not null,
  pontos_max  int  not null default 0,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. PERGUNTAS
-- ------------------------------------------------------------
create table public.perguntas (
  id              uuid primary key default uuid_generate_v4(),
  secao_id        uuid not null references public.secoes(id) on delete cascade,
  ordem           int  not null,
  codigo          text not null,           -- ex: "1.2", "3.5.1"
  texto           text not null,
  tipo            text not null
                    check (tipo in (
                      'sim_nao',           -- Sim/Não binário
                      'escala_3',          -- Ruim / Regular / Bom
                      'escala_5',          -- Péssimo / Ruim / Regular / Bom / Ótimo
                      'nota_livre',        -- Campo numérico livre (0-10)
                      'texto_livre',       -- Comentário aberto
                      'condicional'        -- Só aparece se pai tiver resposta específica
                    )),
  opcoes          jsonb,                   -- [{label, valor, pontos, plano_acao}]
  pontos_max      int not null default 0,
  obrigatoria     boolean not null default true,
  plano_acao_obrigatorio boolean not null default false,
  pergunta_pai_id uuid references public.perguntas(id),
  resposta_pai_gatilho text,              -- qual resposta do pai ativa esta pergunta
  permite_foto    boolean not null default false,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

-- RLS: qualquer autenticado lê; só admin edita
alter table public.perguntas enable row level security;

create policy "autenticado le perguntas"
  on public.perguntas for select
  using (auth.role() = 'authenticated');

create policy "admin edita perguntas"
  on public.perguntas for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.perfil = 'admin'
    )
  );

alter table public.secoes enable row level security;

create policy "autenticado le secoes"
  on public.secoes for select
  using (auth.role() = 'authenticated');

create policy "admin edita secoes"
  on public.secoes for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.perfil = 'admin'
    )
  );

-- ------------------------------------------------------------
-- 4. AVALIAÇÕES (cabeçalho de cada visita)
-- ------------------------------------------------------------
create table public.avaliacoes (
  id              uuid primary key default uuid_generate_v4(),
  usuario_id      uuid not null references public.profiles(id),
  avaliador_nome  text not null,           -- nome digitado na hora
  unidade         text not null,
  turno           text not null default 'manha'
                    check (turno in ('manha', 'tarde', 'noite')),
  status          text not null default 'em_andamento'
                    check (status in ('em_andamento', 'concluida')),
  nota_total      numeric(6,2),
  nota_maxima     numeric(6,2),
  percentual      numeric(5,2),
  checkin_em      timestamptz,
  checkout_em     timestamptz,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

alter table public.avaliacoes enable row level security;

create policy "usuario ve proprias avaliacoes"
  on public.avaliacoes for select
  using (usuario_id = auth.uid());

create policy "usuario insere propria avaliacao"
  on public.avaliacoes for insert
  with check (usuario_id = auth.uid());

create policy "usuario atualiza propria avaliacao"
  on public.avaliacoes for update
  using (usuario_id = auth.uid());

create policy "supervisor e admin veem tudo"
  on public.avaliacoes for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.perfil in ('supervisor', 'admin') or p.pode_ver_analise = true)
    )
  );

-- ------------------------------------------------------------
-- 5. RESPOSTAS (uma linha por pergunta respondida)
-- ------------------------------------------------------------
create table public.respostas (
  id              uuid primary key default uuid_generate_v4(),
  avaliacao_id    uuid not null references public.avaliacoes(id) on delete cascade,
  pergunta_id     uuid not null references public.perguntas(id),
  valor           text,                    -- a opção escolhida ou texto livre
  pontos_obtidos  int not null default 0,
  comentario      text,
  plano_acao      text,
  foto_url        text,                    -- URL do Supabase Storage
  criado_em       timestamptz not null default now(),
  unique (avaliacao_id, pergunta_id)
);

alter table public.respostas enable row level security;

create policy "usuario ve proprias respostas"
  on public.respostas for select
  using (
    exists (
      select 1 from public.avaliacoes a
      where a.id = avaliacao_id and a.usuario_id = auth.uid()
    )
  );

create policy "usuario insere respostas"
  on public.respostas for insert
  with check (
    exists (
      select 1 from public.avaliacoes a
      where a.id = avaliacao_id and a.usuario_id = auth.uid()
    )
  );

create policy "usuario atualiza respostas"
  on public.respostas for update
  using (
    exists (
      select 1 from public.avaliacoes a
      where a.id = avaliacao_id and a.usuario_id = auth.uid()
    )
  );

create policy "supervisor e admin veem respostas"
  on public.respostas for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.perfil in ('supervisor', 'admin') or p.pode_ver_analise = true)
    )
  );

-- ------------------------------------------------------------
-- 6. STORAGE BUCKET para fotos
-- Rode isso no painel do Supabase > Storage
-- ------------------------------------------------------------
-- insert into storage.buckets (id, name, public)
-- values ('checklist-fotos', 'checklist-fotos', false);

-- ------------------------------------------------------------
-- 7. SEED — Questionário baseado no PDF
-- ------------------------------------------------------------
insert into public.secoes (id, ordem, titulo, pontos_max) values
  ('a0000000-0000-0000-0000-000000000001', 1, 'Visão de Consumidor',   160),
  ('a0000000-0000-0000-0000-000000000002', 2, 'Layout e Precificação', 540),
  ('a0000000-0000-0000-0000-000000000003', 3, 'Vendas e Atendimento',  390),
  ('a0000000-0000-0000-0000-000000000004', 4, 'Financeiro',            100),
  ('a0000000-0000-0000-0000-000000000005', 5, 'Processos Gerenciais',  150);

-- Seção 1 — Visão de Consumidor
insert into public.perguntas
  (id, secao_id, ordem, codigo, texto, tipo, opcoes, pontos_max, plano_acao_obrigatorio, permite_foto)
values
(
  'b0000001-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001', 1, '1.1',
  'Qual a sensação ao entrar na loja? A loja está atrativa? Sente prazer em comprar?',
  'texto_livre', null, 0, false, true
),
(
  'b0000001-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001', 2, '1.2',
  'Temperatura da loja, está adequada?',
  'sim_nao',
  '[{"label":"Não","valor":"nao","pontos":0},{"label":"Sim","valor":"sim","pontos":10}]',
  10, false, false
),
(
  'b0000001-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000001', 3, '1.2.1',
  'Já foi solicitado à supervisão a troca de equipamentos ou manutenção para melhorar a temperatura?',
  'condicional',
  '[{"label":"Não","valor":"nao","pontos":0},{"label":"Sim","valor":"sim","pontos":10}]',
  10, true, false
),
(
  'b0000001-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000001', 4, '1.3',
  'As cortinas de ar estão ligadas?',
  'sim_nao',
  '[{"label":"Não","valor":"nao","pontos":0},{"label":"Sim","valor":"sim","pontos":10}]',
  10, false, false
),
(
  'b0000001-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000001', 5, '1.4',
  'A loja está bem iluminada?',
  'escala_3',
  '[{"label":"Ruim","valor":"ruim","pontos":0,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":10,"plano_acao":true},{"label":"Bom","valor":"bom","pontos":20}]',
  20, false, true
),
(
  'b0000001-0000-0000-0000-000000000006',
  'a0000000-0000-0000-0000-000000000001', 6, '1.5',
  'Os funcionários possuem crachá?',
  'sim_nao',
  '[{"label":"Não","valor":"nao","pontos":0},{"label":"Sim","valor":"sim","pontos":10}]',
  10, true, false
),
(
  'b0000001-0000-0000-0000-000000000007',
  'a0000000-0000-0000-0000-000000000001', 7, '1.6',
  'Os colaboradores demonstram uma boa postura?',
  'sim_nao',
  '[{"label":"Não conforme","valor":"nao","pontos":0},{"label":"Conforme","valor":"sim","pontos":20}]',
  20, true, false
),
(
  'b0000001-0000-0000-0000-000000000008',
  'a0000000-0000-0000-0000-000000000001', 8, '1.7',
  'Qual o nível dos colaboradores? Os mesmos estão conversando paralelamente entre si ou demonstrando falta de empatia?',
  'escala_3',
  '[{"label":"Ruim","valor":"ruim","pontos":0,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":10,"plano_acao":true},{"label":"Bom","valor":"bom","pontos":20}]',
  20, false, false
),
(
  'b0000001-0000-0000-0000-000000000009',
  'a0000000-0000-0000-0000-000000000001', 9, '1.8',
  'No modo geral, qual a nota em relação à limpeza da loja?',
  'nota_livre', null, 0, false, true
),
(
  'b0000001-0000-0000-0000-000000000010',
  'a0000000-0000-0000-0000-000000000001', 10, '1.9',
  'No modo geral, de 0 a 10, qual a nota em relação à visão do consumidor?',
  'nota_livre', null, 0, false, false
);

-- Seção 2 — Layout e Precificação (amostra das principais)
insert into public.perguntas
  (id, secao_id, ordem, codigo, texto, tipo, opcoes, pontos_max, plano_acao_obrigatorio, permite_foto)
values
(
  'b0000002-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002', 1, '2.1',
  'A loja está sinalizada e com a layoutização das promoções?',
  'sim_nao',
  '[{"label":"Não","valor":"nao","pontos":0},{"label":"Sim","valor":"sim","pontos":30}]',
  30, true, true
),
(
  'b0000002-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000002', 2, '2.2',
  'As seções de Fraldas estão repostas, organizadas e precificadas?',
  'escala_5',
  '[{"label":"Péssimo","valor":"pessimo","pontos":0,"plano_acao":true},{"label":"Ruim","valor":"ruim","pontos":20,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":30,"plano_acao":true},{"label":"Bom","valor":"bom","pontos":40},{"label":"Ótimo","valor":"otimo","pontos":50}]',
  50, false, true
),
(
  'b0000002-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000002', 3, '2.3',
  'As seções de Leites estão repostas, organizadas e precificadas?',
  'escala_5',
  '[{"label":"Péssimo","valor":"pessimo","pontos":0,"plano_acao":true},{"label":"Ruim","valor":"ruim","pontos":20,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":30,"plano_acao":true},{"label":"Bom","valor":"bom","pontos":40},{"label":"Ótimo","valor":"otimo","pontos":50}]',
  50, false, true
),
(
  'b0000002-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000002', 4, '2.4',
  'As seções de Dermos estão repostas, organizadas e precificadas?',
  'escala_5',
  '[{"label":"Péssimo","valor":"pessimo","pontos":0,"plano_acao":true},{"label":"Ruim","valor":"ruim","pontos":20,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":30},{"label":"Bom","valor":"bom","pontos":40},{"label":"Ótimo","valor":"otimo","pontos":50}]',
  50, false, true
),
(
  'b0000002-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000002', 5, '2.5',
  'A farmacinha está organizada, com produto e precificada?',
  'escala_5',
  '[{"label":"Péssimo","valor":"pessimo","pontos":0,"plano_acao":true},{"label":"Ruim","valor":"ruim","pontos":20,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":30,"plano_acao":true},{"label":"Bom","valor":"bom","pontos":40},{"label":"Ótimo","valor":"otimo","pontos":50}]',
  50, false, true
),
(
  'b0000002-0000-0000-0000-000000000006',
  'a0000000-0000-0000-0000-000000000002', 6, '2.6',
  'As seções de Conveniência estão repostas, organizadas e precificadas?',
  'escala_5',
  '[{"label":"Péssimo","valor":"pessimo","pontos":0,"plano_acao":true},{"label":"Ruim","valor":"ruim","pontos":20,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":30,"plano_acao":true},{"label":"Bom","valor":"bom","pontos":40},{"label":"Ótimo","valor":"otimo","pontos":50}]',
  50, false, false
),
(
  'b0000002-0000-0000-0000-000000000007',
  'a0000000-0000-0000-0000-000000000002', 7, '2.7',
  'As seções dos Freezer e Geladeira estão repostas, organizadas e precificadas?',
  'escala_5',
  '[{"label":"Péssimo","valor":"pessimo","pontos":0,"plano_acao":true},{"label":"Ruim","valor":"ruim","pontos":0,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":10,"plano_acao":true},{"label":"Bom","valor":"bom","pontos":20},{"label":"Ótimo","valor":"otimo","pontos":30}]',
  30, false, true
),
(
  'b0000002-0000-0000-0000-000000000008',
  'a0000000-0000-0000-0000-000000000002', 8, '2.8',
  'Qual o nível de reposição dos itens da perfumaria? Está bem reposta ou aparenta estar "vazia"?',
  'escala_5',
  '[{"label":"Péssimo","valor":"pessimo","pontos":0,"plano_acao":true},{"label":"Ruim","valor":"ruim","pontos":20,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":30,"plano_acao":true},{"label":"Bom","valor":"bom","pontos":40},{"label":"Ótimo","valor":"otimo","pontos":50}]',
  50, false, true
),
(
  'b0000002-0000-0000-0000-000000000009',
  'a0000000-0000-0000-0000-000000000002', 9, '2.9',
  'Os cestões de medicamentos/perfumaria estão cheios e precificados?',
  'escala_5',
  '[{"label":"Péssimo","valor":"pessimo","pontos":0,"plano_acao":true},{"label":"Ruim","valor":"ruim","pontos":20,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":30},{"label":"Bom","valor":"bom","pontos":40},{"label":"Ótimo","valor":"otimo","pontos":50}]',
  50, false, false
),
(
  'b0000002-0000-0000-0000-000000000010',
  'a0000000-0000-0000-0000-000000000002', 10, '2.10',
  'A precificação no geral fora do balcão está completa? Se não, apontar qual seção precisa de atenção.',
  'escala_5',
  '[{"label":"Péssimo","valor":"pessimo","pontos":0,"plano_acao":true},{"label":"Ruim","valor":"ruim","pontos":20,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":30,"plano_acao":true},{"label":"Bom","valor":"bom","pontos":40},{"label":"Ótimo","valor":"otimo","pontos":50}]',
  50, false, false
),
(
  'b0000002-0000-0000-0000-000000000011',
  'a0000000-0000-0000-0000-000000000002', 11, '2.11',
  'As pontas de gôndolas estão fazendo sentido com a seção?',
  'escala_5',
  '[{"label":"Péssimo","valor":"pessimo","pontos":0,"plano_acao":true},{"label":"Ruim","valor":"ruim","pontos":20,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":30},{"label":"Bom","valor":"bom","pontos":40},{"label":"Ótimo","valor":"otimo","pontos":50}]',
  50, false, false
),
(
  'b0000002-0000-0000-0000-000000000012',
  'a0000000-0000-0000-0000-000000000002', 12, '2.12',
  'E a limpeza em relação a todos esses pontos?',
  'texto_livre', null, 0, false, true
),
(
  'b0000002-0000-0000-0000-000000000013',
  'a0000000-0000-0000-0000-000000000002', 13, '2.13',
  'No modo geral, de 0 a 10, qual a nota em relação ao layout e à precificação da loja?',
  'nota_livre', null, 0, false, false
);

-- Seção 3 — Vendas e Atendimento
insert into public.perguntas
  (id, secao_id, ordem, codigo, texto, tipo, opcoes, pontos_max, plano_acao_obrigatorio, permite_foto)
values
(
  'b0000003-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000003', 1, '3.1',
  'A equipe no balcão está realizando a abordagem com o cliente usando o padrão Ultra/Maxi?',
  'escala_3',
  '[{"label":"Ruim","valor":"ruim","pontos":0,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":20,"plano_acao":true},{"label":"Bom","valor":"bom","pontos":30}]',
  30, false, false
),
(
  'b0000003-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003', 2, '3.2',
  'A equipe no caixa está realizando a abordagem com o cliente usando o padrão Ultra/Maxi?',
  'escala_3',
  '[{"label":"Ruim","valor":"ruim","pontos":0,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":20,"plano_acao":true},{"label":"Bom","valor":"bom","pontos":30}]',
  30, false, false
),
(
  'b0000003-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000003', 3, '3.3',
  'A equipe está atendendo fora do balcão? (Entregando cestinha, abordagem na perfumaria, na fralda...)',
  'escala_5',
  '[{"label":"Péssimo","valor":"pessimo","pontos":0,"plano_acao":true},{"label":"Ruim","valor":"ruim","pontos":20,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":30},{"label":"Bom","valor":"bom","pontos":40},{"label":"Ótimo","valor":"otimo","pontos":50}]',
  50, false, false
),
(
  'b0000003-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000003', 4, '3.4',
  'A equipe está agregando venda? (Em toda área de loja: balcão, perfumaria...) Apontar qual área precisa de atenção.',
  'escala_3',
  '[{"label":"Ruim","valor":"ruim","pontos":0,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":20,"plano_acao":true},{"label":"Bom","valor":"bom","pontos":30}]',
  30, false, false
),
(
  'b0000003-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000003', 5, '3.5',
  'A equipe pede o CPF para cadastro?',
  'sim_nao',
  '[{"label":"Não","valor":"nao","pontos":0},{"label":"Sim","valor":"sim","pontos":10}]',
  10, false, false
),
(
  'b0000003-0000-0000-0000-000000000006',
  'a0000000-0000-0000-0000-000000000003', 6, '3.6',
  'Qual o nível de limpeza e conservação dos teclados dos caixas?',
  'escala_3',
  '[{"label":"Ruim","valor":"ruim","pontos":0},{"label":"Regular","valor":"regular","pontos":10},{"label":"Bom","valor":"bom","pontos":20}]',
  20, false, false
),
(
  'b0000003-0000-0000-0000-000000000007',
  'a0000000-0000-0000-0000-000000000003', 7, '3.7',
  'Qual o nível de limpeza e conservação dos teclados dos balcões?',
  'escala_3',
  '[{"label":"Ruim","valor":"ruim","pontos":0},{"label":"Regular","valor":"regular","pontos":10},{"label":"Bom","valor":"bom","pontos":20}]',
  20, false, false
),
(
  'b0000003-0000-0000-0000-000000000008',
  'a0000000-0000-0000-0000-000000000003', 8, '3.8',
  'Como você avalia a limpeza e organização do caixa?',
  'escala_5',
  '[{"label":"Péssimo","valor":"pessimo","pontos":0,"plano_acao":true},{"label":"Ruim","valor":"ruim","pontos":20,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":30,"plano_acao":true},{"label":"Bom","valor":"bom","pontos":40},{"label":"Ótimo","valor":"otimo","pontos":50}]',
  50, false, true
),
(
  'b0000003-0000-0000-0000-000000000009',
  'a0000000-0000-0000-0000-000000000003', 9, '3.9',
  'Como você avalia a limpeza e organização do balcão?',
  'escala_5',
  '[{"label":"Péssimo","valor":"pessimo","pontos":0,"plano_acao":true},{"label":"Ruim","valor":"ruim","pontos":20,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":30},{"label":"Bom","valor":"bom","pontos":40},{"label":"Ótimo","valor":"otimo","pontos":50}]',
  50, false, true
),
(
  'b0000003-0000-0000-0000-000000000010',
  'a0000000-0000-0000-0000-000000000003', 10, '3.10',
  'As gavetas dos balcões estão todas funcionando?',
  'sim_nao',
  '[{"label":"Não","valor":"nao","pontos":0},{"label":"Sim","valor":"sim","pontos":10}]',
  10, true, false
),
(
  'b0000003-0000-0000-0000-000000000011',
  'a0000000-0000-0000-0000-000000000003', 11, '3.11',
  'As gavetas dos caixas estão todas funcionando?',
  'sim_nao',
  '[{"label":"Não","valor":"nao","pontos":0},{"label":"Sim","valor":"sim","pontos":10}]',
  10, true, false
),
(
  'b0000003-0000-0000-0000-000000000012',
  'a0000000-0000-0000-0000-000000000003', 12, '3.12',
  'Os bipadores dos balcões estão todos funcionando?',
  'sim_nao',
  '[{"label":"Não","valor":"nao","pontos":0},{"label":"Sim","valor":"sim","pontos":10}]',
  10, true, false
),
(
  'b0000003-0000-0000-0000-000000000013',
  'a0000000-0000-0000-0000-000000000003', 13, '3.13',
  'Os bipadores dos caixas estão todos funcionando?',
  'sim_nao',
  '[{"label":"Não","valor":"nao","pontos":0},{"label":"Sim","valor":"sim","pontos":10}]',
  10, true, false
),
(
  'b0000003-0000-0000-0000-000000000014',
  'a0000000-0000-0000-0000-000000000003', 14, '3.14',
  'O TEF está funcionando em todos os caixas?',
  'sim_nao',
  '[{"label":"Não","valor":"nao","pontos":0},{"label":"Sim","valor":"sim","pontos":10}]',
  10, false, false
),
(
  'b0000003-0000-0000-0000-000000000015',
  'a0000000-0000-0000-0000-000000000003', 15, '3.15',
  'A impressora de cupom fiscal está funcionando em todos os caixas?',
  'sim_nao',
  '[{"label":"Não","valor":"nao","pontos":0},{"label":"Sim","valor":"sim","pontos":10}]',
  10, false, false
),
(
  'b0000003-0000-0000-0000-000000000016',
  'a0000000-0000-0000-0000-000000000003', 16, '3.16',
  'As cadeiras dos caixas estão todas funcionando e bem conservadas?',
  'sim_nao',
  '[{"label":"Não","valor":"nao","pontos":0},{"label":"Sim","valor":"sim","pontos":10}]',
  10, true, false
),
(
  'b0000003-0000-0000-0000-000000000017',
  'a0000000-0000-0000-0000-000000000003', 17, '3.17',
  'No modo geral, de 0 a 10, qual a nota em relação às vendas e atendimento da loja?',
  'nota_livre', null, 0, false, false
);

-- Seção 4 — Financeiro
insert into public.perguntas
  (id, secao_id, ordem, codigo, texto, tipo, opcoes, pontos_max, plano_acao_obrigatorio, permite_foto)
values
(
  'b0000004-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000004', 1, '4.1',
  'A contagem do fundo de cofre bateu? (Sobra acima de R$10 ou qualquer falta = Não conforme)',
  'sim_nao',
  '[{"label":"Não conforme","valor":"nao","pontos":0},{"label":"Conforme","valor":"sim","pontos":100}]',
  100, true, true
);

-- Seção 5 — Processos Gerenciais
insert into public.perguntas
  (id, secao_id, ordem, codigo, texto, tipo, opcoes, pontos_max, plano_acao_obrigatorio, permite_foto)
values
(
  'b0000005-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000005', 1, '5.1',
  'Como você avalia o grau de conhecimento do gestor na execução e demandas das funções do CAIXA?',
  'escala_5',
  '[{"label":"Péssimo","valor":"pessimo","pontos":0,"plano_acao":true},{"label":"Ruim","valor":"ruim","pontos":20,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":30,"plano_acao":true},{"label":"Bom","valor":"bom","pontos":40},{"label":"Ótimo","valor":"otimo","pontos":50}]',
  50, false, false
),
(
  'b0000005-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000005', 2, '5.2',
  'Como você avalia o grau de conhecimento do gestor na execução e demandas das funções da ADM?',
  'escala_5',
  '[{"label":"Péssimo","valor":"pessimo","pontos":0,"plano_acao":true},{"label":"Ruim","valor":"ruim","pontos":20,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":30,"plano_acao":true},{"label":"Bom","valor":"bom","pontos":40},{"label":"Ótimo","valor":"otimo","pontos":50}]',
  50, false, false
),
(
  'b0000005-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000005', 3, '5.3',
  'Como você avalia o grau de conhecimento do gestor na execução e demandas das funções do ESTOQUISTA?',
  'escala_5',
  '[{"label":"Péssimo","valor":"pessimo","pontos":0,"plano_acao":true},{"label":"Ruim","valor":"ruim","pontos":20,"plano_acao":true},{"label":"Regular","valor":"regular","pontos":30,"plano_acao":true},{"label":"Bom","valor":"bom","pontos":40},{"label":"Ótimo","valor":"otimo","pontos":50}]',
  50, false, false
);

-- Atualizar perguntas condicionais com referência ao pai
update public.perguntas set
  pergunta_pai_id = 'b0000001-0000-0000-0000-000000000002',
  resposta_pai_gatilho = 'nao'
where codigo = '1.2.1';

-- ------------------------------------------------------------
-- 8. FUNÇÃO — Calcular e gravar nota da avaliação
-- ------------------------------------------------------------
create or replace function public.calcular_nota_avaliacao(p_avaliacao_id uuid)
returns void language plpgsql as $$
declare
  v_nota_total  numeric := 0;
  v_nota_max    numeric := 0;
begin
  -- Uma linha por pergunta (resposta mais recente) e pontos obtidos limitados ao máximo da pergunta.
  select
    coalesce(sum(least(r.pontos_obtidos, p.pontos_max)), 0),
    coalesce(sum(p.pontos_max), 0)
  into v_nota_total, v_nota_max
  from (
    select distinct on (r2.pergunta_id) r2.*
    from public.respostas r2
    where r2.avaliacao_id = p_avaliacao_id
    order by r2.pergunta_id, r2.id desc
  ) r
  join public.perguntas p on p.id = r.pergunta_id;

  update public.avaliacoes set
    nota_total  = v_nota_total,
    nota_maxima = v_nota_max,
    percentual  = case when v_nota_max > 0
                    then round((v_nota_total / v_nota_max) * 100, 2)
                    else 0 end,
    atualizado_em = now()
  where id = p_avaliacao_id;
end;
$$;
