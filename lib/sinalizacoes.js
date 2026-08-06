/**
 * Lógica de sinalizações pendentes (loja = avaliacoes.unidade).
 * Usada no concluir da avaliação; UI ainda não consome (Prompt 2).
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   loja: string,
 *   avaliacaoId: string,
 *   items: Array<Record<string, unknown>>,
 * }} opts
 */
export async function processarSinalizacoesNoConcluir(supabase, { loja, avaliacaoId, items }) {
  const lojaNorm = String(loja ?? "").trim();
  if (!lojaNorm || !avaliacaoId) return { processados: 0 };
  if (!Array.isArray(items) || items.length === 0) return { processados: 0 };

  // Textos das respostas já gravadas (fallback para texto_original)
  const perguntaIds = [
    ...new Set(items.map((i) => i.pergunta_id).filter(Boolean).map(String)),
  ];
  let respostasMap = {};
  if (perguntaIds.length > 0) {
    const { data: rows, error } = await supabase
      .from("respostas")
      .select("pergunta_id, comentario, plano_acao")
      .eq("avaliacao_id", avaliacaoId)
      .in("pergunta_id", perguntaIds);
    if (error) throw error;
    respostasMap = Object.fromEntries(
      (rows ?? []).map((r) => [String(r.pergunta_id), r])
    );
  }

  let processados = 0;

  for (const it of items) {
    const pergunta_id = it.pergunta_id != null ? String(it.pergunta_id).trim() : "";
    if (!pergunta_id) continue;

    const respBd = respostasMap[pergunta_id] ?? {};
    const comentarioTexto =
      it.comentario != null && String(it.comentario).trim() !== ""
        ? String(it.comentario).trim()
        : respBd.comentario != null
          ? String(respBd.comentario).trim()
          : "";
    const planoTexto =
      it.plano_acao != null && String(it.plano_acao).trim() !== ""
        ? String(it.plano_acao).trim()
        : respBd.plano_acao != null
          ? String(respBd.plano_acao).trim()
          : "";

    // --- Novas sinalizações ---
    if (it.sinalizar_comentario === true && comentarioTexto) {
      await inserirSinalizacaoSeNaoExiste(supabase, {
        loja: lojaNorm,
        pergunta_id,
        tipo_campo: "comentario",
        texto_original: comentarioTexto,
        avaliacao_origem_id: avaliacaoId,
      });
      processados += 1;
    }
    if (it.sinalizar_plano_acao === true && planoTexto) {
      await inserirSinalizacaoSeNaoExiste(supabase, {
        loja: lojaNorm,
        pergunta_id,
        tipo_campo: "plano_acao",
        texto_original: planoTexto,
        avaliacao_origem_id: avaliacaoId,
      });
      processados += 1;
    }

    // --- Verificações ---
    const vCom = normalizarVerificacao(it.verificacao_comentario);
    if (vCom === "sim") {
      await resolverSinalizacao(supabase, {
        loja: lojaNorm,
        pergunta_id,
        tipo_campo: "comentario",
        avaliacao_resolucao_id: avaliacaoId,
      });
      processados += 1;
    } else if (vCom === "nao") {
      await marcarNaoResolvido(supabase, {
        loja: lojaNorm,
        pergunta_id,
        tipo_campo: "comentario",
        motivo: it.motivo_comentario != null ? String(it.motivo_comentario) : "",
        avaliacao_id: avaliacaoId,
      });
      processados += 1;
    }

    const vPla = normalizarVerificacao(it.verificacao_plano_acao);
    if (vPla === "sim") {
      await resolverSinalizacao(supabase, {
        loja: lojaNorm,
        pergunta_id,
        tipo_campo: "plano_acao",
        avaliacao_resolucao_id: avaliacaoId,
      });
      processados += 1;
    } else if (vPla === "nao") {
      await marcarNaoResolvido(supabase, {
        loja: lojaNorm,
        pergunta_id,
        tipo_campo: "plano_acao",
        motivo: it.motivo_plano_acao != null ? String(it.motivo_plano_acao) : "",
        avaliacao_id: avaliacaoId,
      });
      processados += 1;
    }
  }

  return { processados };
}

function normalizarVerificacao(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim().toLowerCase();
  if (s === "sim" || s === "nao") return s;
  return null;
}

async function inserirSinalizacaoSeNaoExiste(
  supabase,
  { loja, pergunta_id, tipo_campo, texto_original, avaliacao_origem_id }
) {
  const { data: existente, error: errSel } = await supabase
    .from("sinalizacoes_pendentes")
    .select("id")
    .eq("loja", loja)
    .eq("pergunta_id", pergunta_id)
    .eq("tipo_campo", tipo_campo)
    .eq("status", "pendente")
    .maybeSingle();

  if (errSel) throw errSel;
  if (existente?.id) return; // já há pendência ativa — não duplicar

  const { error } = await supabase.from("sinalizacoes_pendentes").insert({
    loja,
    pergunta_id,
    tipo_campo,
    texto_original,
    status: "pendente",
    avaliacao_origem_id,
  });

  // Corrida rara com o índice único parcial
  if (error) {
    if (error.code === "23505") return;
    throw error;
  }
}

async function resolverSinalizacao(
  supabase,
  { loja, pergunta_id, tipo_campo, avaliacao_resolucao_id }
) {
  const agora = new Date().toISOString();
  const { error } = await supabase
    .from("sinalizacoes_pendentes")
    .update({
      status: "resolvido",
      resolvido_em: agora,
      avaliacao_resolucao_id,
      ultima_verificacao_em: agora,
      ultima_avaliacao_verificacao_id: avaliacao_resolucao_id,
    })
    .eq("loja", loja)
    .eq("pergunta_id", pergunta_id)
    .eq("tipo_campo", tipo_campo)
    .eq("status", "pendente");

  if (error) throw error;
}

async function marcarNaoResolvido(
  supabase,
  { loja, pergunta_id, tipo_campo, motivo, avaliacao_id }
) {
  const { error } = await supabase.rpc("sinalizacao_marcar_nao_resolvido", {
    p_loja: loja,
    p_pergunta_id: pergunta_id,
    p_tipo_campo: tipo_campo,
    p_motivo: motivo ?? "",
    p_avaliacao_id: avaliacao_id,
  });
  if (error) throw error;
}
