/** Mapeamento de respostas com join a `perguntas` — partilhado entre rotas API de avaliações. */

function parseOpcoes(opcoes) {
  if (opcoes == null) return [];
  let o = opcoes;
  if (typeof o === "string") {
    try {
      o = JSON.parse(o);
    } catch {
      return [];
    }
  }
  return Array.isArray(o) ? o : [];
}

function perguntaSingular(r) {
  const perg = r?.perguntas;
  return perg && !Array.isArray(perg) ? perg : Array.isArray(perg) ? perg[0] : null;
}

function respostaExibicao(tipo, valorStr, comentario, opcoesRaw) {
  const t = tipo || "";
  const v = valorStr ?? "";
  const c = comentario != null ? String(comentario).trim() : "";

  if (t === "texto_livre" || t === "nota_livre") {
    const s = String(v).trim() || c;
    return s || "—";
  }

  const opts = parseOpcoes(opcoesRaw);
  const op = opts.find((x) => String(x.valor) === String(v));
  if (op?.label != null) return String(op.label);
  if (String(v).trim()) return String(v);
  if (c) return c;
  return "—";
}

export function mapRespostasParaApi(rows) {
  return (rows ?? []).map((r) => {
    const p = perguntaSingular(r);
    const secao_id = p?.secao_id ?? null;
    const valorStr = r.valor != null ? String(r.valor) : "";
    const tipo = p?.tipo ?? "";
    const resposta_exibicao = respostaExibicao(
      tipo,
      valorStr,
      r.comentario,
      p?.opcoes
    );

    const fotoRaw = r.foto_url != null ? String(r.foto_url).trim() : "";
    const foto_url =
      fotoRaw && !fotoRaw.startsWith("blob:") ? fotoRaw : null;

    return {
      secao_id,
      pergunta_id: r.pergunta_id,
      resposta_label: valorStr,
      resposta_exibicao,
      pontos_obtidos: Number(r.pontos_obtidos) || 0,
      comentario: r.comentario != null && String(r.comentario).trim() !== "" ? String(r.comentario).trim() : null,
      plano_acao: r.plano_acao != null && String(r.plano_acao).trim() !== "" ? String(r.plano_acao).trim() : null,
      pergunta_texto: p?.texto != null ? String(p.texto) : null,
      pergunta_codigo: p?.codigo != null ? String(p.codigo) : null,
      pergunta_tipo: p?.tipo != null ? String(p.tipo) : null,
      foto_url,
    };
  });
}

/** Turno do modelo de perguntas: gerente ↔ manhã, supervisor ↔ tarde */
export function turnoModeloPorTipoAvaliador(tipo_avaliador) {
  return tipo_avaliador === "supervisor" ? "tarde" : "manha";
}
