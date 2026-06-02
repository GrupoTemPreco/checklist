-- Migração: calcular_nota_avaliacao — numerador (respostas dedup + LEAST) e denominador
-- = soma de pontos_max de todas as perguntas ativas do turno da avaliação (via seções.turno).
-- Executar no Supabase: SQL Editor → New query → colar e Run.

create or replace function public.calcular_nota_avaliacao(p_avaliacao_id uuid)
returns void language plpgsql as $$
declare
  v_nota_total  numeric := 0;
  v_nota_max    numeric := 0;
  v_turno       text;
begin
  select a.turno into v_turno
  from public.avaliacoes a
  where a.id = p_avaliacao_id;

  -- Numerador: uma resposta por pergunta (a mais recente) e pontos limitados ao máximo da pergunta.
  select coalesce(sum(least(r.pontos_obtidos, p.pontos_max)), 0)
  into v_nota_total
  from (
    select distinct on (r2.pergunta_id) r2.*
    from public.respostas r2
    where r2.avaliacao_id = p_avaliacao_id
    order by r2.pergunta_id, r2.id desc
  ) r
  join public.perguntas p on p.id = r.pergunta_id;

  -- Denominador: soma dos pontos_max de todas as perguntas ativas do mesmo turno da avaliação
  -- (independente de existir resposta).
  select coalesce(sum(p.pontos_max), 0)
  into v_nota_max
  from public.perguntas p
  join public.secoes s on s.id = p.secao_id
  where s.turno = v_turno
    and p.ativo is true;

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
