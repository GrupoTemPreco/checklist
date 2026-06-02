-- Migração: corrigir calcular_nota_avaliacao (respostas duplicadas + cap de pontos).
-- Executar no Supabase: SQL Editor → New query → colar e Run.

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
