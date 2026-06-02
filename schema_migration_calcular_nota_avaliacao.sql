-- Migração: calcular_nota_avaliacao
--   * Numerador: 1 resposta por pergunta (a mais recente) com teto LEAST(pontos_obtidos, pontos_max).
--   * Denominador (nota_maxima): só as perguntas que APARECERAM na avaliação =
--     não-condicionais ativas do turno + condicionais cuja pai recebeu a resposta-gatilho.
-- Executar no Supabase: SQL Editor -> New query -> colar TUDO -> Run.

create or replace function public.calcular_nota_avaliacao(p_avaliacao_id uuid)
returns void language plpgsql as $$
declare
  v_nota_total  numeric := 0;
  v_nota_max    numeric := 0;
  v_turno       text;
begin
  -- Turno do MODELO de perguntas (gerente -> manha, supervisor -> tarde).
  -- NÃO usar avaliacoes.turno: esse é o turno de trabalho (manhã/tarde/noite),
  -- diferente do conjunto de perguntas, que depende de tipo_avaliador.
  select case when a.tipo_avaliador = 'supervisor' then 'tarde' else 'manha' end
  into v_turno
  from public.avaliacoes a
  where a.id = p_avaliacao_id;

  -- resp: a resposta mais recente de cada pergunta nesta avaliação.
  -- aplicaveis: perguntas que "apareceram" na avaliação = não-condicionais ativas do turno,
  --   mais as condicionais cuja pergunta-pai recebeu a resposta-gatilho.
  with resp as (
    select distinct on (r.pergunta_id) r.pergunta_id, r.valor, r.pontos_obtidos
    from public.respostas r
    where r.avaliacao_id = p_avaliacao_id
    order by r.pergunta_id, r.id desc
  ),
  aplicaveis as (
    select p.id, p.pontos_max
    from public.perguntas p
    join public.secoes s on s.id = p.secao_id
    where s.turno = v_turno
      and s.ativo is true
      and p.ativo is true
      and (
        p.tipo <> 'condicional'
        or exists (
          select 1 from resp rp
          where rp.pergunta_id = p.pergunta_pai_id
            and rp.valor = p.resposta_pai_gatilho
        )
      )
  )
  select
    coalesce(sum(least(rp.pontos_obtidos, a.pontos_max)), 0),
    coalesce(sum(a.pontos_max), 0)
  into v_nota_total, v_nota_max
  from aplicaveis a
  left join resp rp on rp.pergunta_id = a.id;

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

-- ------------------------------------------------------------
-- RECÁLCULO DAS AVALIAÇÕES JÁ EXISTENTES (rode SEMPRE após trocar a função).
-- A função só roda ao concluir; as avaliações antigas mantêm a nota gravada
-- com a lógica anterior até serem reprocessadas por este bloco.
-- ------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select id from public.avaliacoes loop
    perform public.calcular_nota_avaliacao(r.id);
  end loop;
end;
$$;
