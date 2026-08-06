/** Carregamento e montagem de avaliação (histórico / impressão). */

import { mapRespostasParaApi } from "@/lib/avaliacoes-resposta-map";

export const AVALIACAO_DETALHE_SELECT = `
  id,
  usuario_id,
  avaliador_nome,
  unidade,
  turno,
  percentual,
  nota_total,
  nota_maxima,
  criado_em,
  checkout_em,
  status,
  tipo_avaliador,
  respostas (
    pergunta_id,
    valor,
    pontos_obtidos,
    comentario,
    plano_acao,
    foto_url,
    perguntas ( secao_id, texto, codigo, tipo, opcoes )
  )
`;

export function mapAvaliacaoDetalhe(av) {
  return {
    id: av.id,
    usuario_id: av.usuario_id != null ? String(av.usuario_id) : null,
    avaliador_nome: av.avaliador_nome,
    unidade: av.unidade,
    turno: av.turno,
    percentual: av.percentual != null ? Number(av.percentual) : 0,
    nota_total: av.nota_total != null ? Number(av.nota_total) : null,
    nota_maxima: av.nota_maxima != null ? Number(av.nota_maxima) : null,
    criado_em: av.criado_em,
    checkout_em: av.checkout_em,
    status: av.status,
    tipo_avaliador: av.tipo_avaliador ?? null,
    respostas: mapRespostasParaApi(av.respostas),
  };
}

export async function loadAvaliacaoById(client, id) {
  const { data, error } = await client
    .from("avaliacoes")
    .select(AVALIACAO_DETALHE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapAvaliacaoDetalhe(data);
}

export async function loadSecoesAtivasMontagem(client) {
  const { data, error } = await client
    .from("secoes")
    .select("id, ordem, titulo, pontos_max, turno")
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    ordem: s.ordem,
    titulo: s.titulo,
    pontos_max: Number(s.pontos_max) || 0,
    turno: s.turno != null ? String(s.turno) : null,
  }));
}

/**
 * Mesmas regras do histórico: gerente só a própria; supervisor/admin todas.
 * @throws {{ message: string, status: number }}
 */
export function assertAcessoAvaliacao({ perfil, uid, avaliacao }) {
  const p = String(perfil ?? "").trim();
  if (p === "admin" || p === "supervisor") return;

  if (p === "gerente") {
    const u = String(uid ?? "").trim();
    if (!u) {
      const err = new Error("uid é obrigatório para perfil gerente.");
      err.status = 400;
      throw err;
    }
    if (String(avaliacao.usuario_id ?? "") !== u) {
      const err = new Error("Sem permissão para ver esta avaliação.");
      err.status = 403;
      throw err;
    }
    return;
  }

  const err = new Error("perfil deve ser gerente, supervisor ou admin.");
  err.status = 400;
  throw err;
}

export function secoesComRespostasParaMontar(secoesLista, respostas, fallbackTurno = null) {
  const secaoIds = new Set(
    (respostas ?? [])
      .map((r) => (r.secao_id != null ? String(r.secao_id) : null))
      .filter(Boolean)
  );
  const todas = secoesLista ?? [];
  const dasRespostas = todas
    .filter((sc) => secaoIds.has(String(sc.id)))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  if (dasRespostas.length > 0) return dasRespostas;
  if (fallbackTurno) {
    return todas
      .filter((sc) => (sc.turno ?? "manha") === fallbackTurno)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }
  return [...todas].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

export function montarPorSecao(secoes, respostas) {
  const soma = new Map();
  for (const s of secoes) soma.set(String(s.id), 0);
  for (const r of respostas || []) {
    const sid = r.secao_id != null ? String(r.secao_id) : "";
    if (!sid || !soma.has(sid)) continue;
    soma.set(sid, (soma.get(sid) || 0) + (r.pontos_obtidos || 0));
  }
  return secoes.map((s) => {
    const id = String(s.id);
    const obt = soma.get(id) || 0;
    const max = s.pontos_max || 0;
    const percentual = max > 0 ? Math.min(100, Math.round((obt / max) * 100)) : 0;
    return {
      secao_id: s.id,
      titulo: s.titulo,
      percentual,
      pontos_obtidos_secao: obt,
      pontos_max_secao: max,
    };
  });
}

/** Perfil efetivo para a URL de impressão (alinhado ao histórico). */
export function perfilParaImpressao({ userPerfil, atuaComoSupervisor }) {
  if (atuaComoSupervisor || userPerfil === "admin" || userPerfil === "supervisor") {
    return userPerfil === "admin" ? "admin" : "supervisor";
  }
  return "gerente";
}

export function buildUrlImprimirAvaliacao(avaliacaoId, { perfil, uid }) {
  const qs = new URLSearchParams();
  qs.set("perfil", perfil);
  if (perfil === "gerente" && uid != null && String(uid).trim() !== "") {
    qs.set("uid", String(uid));
  }
  return `/avaliacoes/${avaliacaoId}/imprimir?${qs}`;
}
