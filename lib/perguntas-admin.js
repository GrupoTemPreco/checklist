import { turnoModeloPorTipoAvaliador } from "@/lib/avaliacoes-resposta-map";

export const TIPOS_PERGUNTA = [
  "sim_nao",
  "escala_3",
  "escala_5",
  "nota_livre",
  "texto_livre",
  "condicional",
];

export const TURNOS_VALIDOS = ["manha", "tarde", "noite"];

export function assertPerfilAdmin(perfil) {
  if (perfil !== "admin") {
    const err = new Error("Acesso restrito a administradores.");
    err.status = 403;
    throw err;
  }
}

export function turnoModeloFromTipoAvaliador(tipo) {
  return turnoModeloPorTipoAvaliador(tipo === "supervisor" ? "supervisor" : "gerente");
}

function parseOpcoesRaw(opcoes) {
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

export function normalizarOpcoesParaDb(opcoes, tipo) {
  if (tipo === "texto_livre" || tipo === "nota_livre") return null;
  const arr = parseOpcoesRaw(opcoes);
  if (arr.length === 0) {
    const err = new Error("Perguntas com opções exigem pelo menos uma opção.");
    err.status = 400;
    throw err;
  }
  return arr.map((op, i) => {
    const label = String(op?.label ?? "").trim();
    const valor = String(op?.valor ?? "").trim();
    if (!label || !valor) {
      const err = new Error(`Opção ${i + 1}: label e valor são obrigatórios.`);
      err.status = 400;
      throw err;
    }
    const pontos = Number(op?.pontos);
    if (!Number.isFinite(pontos)) {
      const err = new Error(`Opção "${label}": pontos inválidos.`);
      err.status = 400;
      throw err;
    }
    const out = { label, valor, pontos };
    if (op?.plano_acao) out.plano_acao = true;
    return out;
  });
}

export function pontosMaxFromOpcoes(opcoes) {
  const arr = parseOpcoesRaw(opcoes);
  if (arr.length === 0) return 0;
  return Math.max(0, ...arr.map((o) => Number(o?.pontos) || 0));
}

export function validarPayloadPergunta(body, { isCreate = false } = {}) {
  const tipo = String(body?.tipo ?? "").trim();
  if (!TIPOS_PERGUNTA.includes(tipo)) {
    const err = new Error(`tipo inválido. Use: ${TIPOS_PERGUNTA.join(", ")}.`);
    err.status = 400;
    throw err;
  }

  const texto = String(body?.texto ?? "").trim();
  if (!texto) {
    const err = new Error("texto é obrigatório.");
    err.status = 400;
    throw err;
  }

  const codigo = String(body?.codigo ?? "").trim();
  if (!codigo) {
    const err = new Error("codigo é obrigatório.");
    err.status = 400;
    throw err;
  }

  const secao_id = String(body?.secao_id ?? "").trim();
  if (!secao_id) {
    const err = new Error("secao_id é obrigatório.");
    err.status = 400;
    throw err;
  }

  const ordem = Number(body?.ordem);
  if (!Number.isInteger(ordem) || ordem < 1) {
    const err = new Error("ordem deve ser um inteiro ≥ 1.");
    err.status = 400;
    throw err;
  }

  const opcoes = normalizarOpcoesParaDb(body?.opcoes, tipo);
  let pontos_max = Number(body?.pontos_max);
  if (!Number.isFinite(pontos_max)) {
    pontos_max = pontosMaxFromOpcoes(opcoes);
  }

  const payload = {
    secao_id,
    ordem,
    codigo,
    texto,
    tipo,
    opcoes,
    pontos_max,
    obrigatoria: body?.obrigatoria !== false,
    plano_acao_obrigatorio: !!body?.plano_acao_obrigatorio,
    permite_foto: !!body?.permite_foto,
    ativo: body?.ativo !== false,
    atualizado_em: new Date().toISOString(),
  };

  if (tipo === "condicional") {
    const pergunta_pai_id = body?.pergunta_pai_id
      ? String(body.pergunta_pai_id).trim()
      : null;
    const resposta_pai_gatilho = body?.resposta_pai_gatilho
      ? String(body.resposta_pai_gatilho).trim()
      : null;
    if (!pergunta_pai_id || !resposta_pai_gatilho) {
      const err = new Error(
        "Perguntas condicionais exigem pergunta_pai_id e resposta_pai_gatilho."
      );
      err.status = 400;
      throw err;
    }
    payload.pergunta_pai_id = pergunta_pai_id;
    payload.resposta_pai_gatilho = resposta_pai_gatilho;
  } else {
    payload.pergunta_pai_id = null;
    payload.resposta_pai_gatilho = null;
  }

  if (!isCreate) {
    const id = String(body?.id ?? "").trim();
    if (!id) {
      const err = new Error("id é obrigatório para atualização.");
      err.status = 400;
      throw err;
    }
    payload.id = id;
  }

  return payload;
}

export function perguntaParaForm(p) {
  return {
    id: p.id,
    secao_id: p.secao_id,
    ordem: p.ordem,
    codigo: p.codigo ?? "",
    texto: p.texto ?? "",
    tipo: p.tipo ?? "sim_nao",
    opcoes: parseOpcoesRaw(p.opcoes),
    pontos_max: p.pontos_max ?? 0,
    obrigatoria: p.obrigatoria !== false,
    plano_acao_obrigatorio: !!p.plano_acao_obrigatorio,
    permite_foto: !!p.permite_foto,
    ativo: p.ativo !== false,
    pergunta_pai_id: p.pergunta_pai_id ?? "",
    resposta_pai_gatilho: p.resposta_pai_gatilho ?? "",
  };
}

export const OPCOES_PADRAO_POR_TIPO = {
  sim_nao: [
    { label: "Não", valor: "nao", pontos: 0 },
    { label: "Sim", valor: "sim", pontos: 10 },
  ],
  escala_3: [
    { label: "Ruim", valor: "ruim", pontos: 0, plano_acao: true },
    { label: "Regular", valor: "regular", pontos: 10, plano_acao: true },
    { label: "Bom", valor: "bom", pontos: 20 },
  ],
  escala_5: [
    { label: "Péssimo", valor: "pessimo", pontos: 0, plano_acao: true },
    { label: "Ruim", valor: "ruim", pontos: 20, plano_acao: true },
    { label: "Regular", valor: "regular", pontos: 30, plano_acao: true },
    { label: "Bom", valor: "bom", pontos: 40 },
    { label: "Ótimo", valor: "otimo", pontos: 50 },
  ],
  condicional: [
    { label: "Não", valor: "nao", pontos: 0, plano_acao: true },
    { label: "Sim", valor: "sim", pontos: 10 },
  ],
};

export function formVazioNovaPergunta(secao_id, ordem) {
  return {
    secao_id: secao_id ?? "",
    ordem: ordem ?? 1,
    codigo: "",
    texto: "",
    tipo: "sim_nao",
    opcoes: [...OPCOES_PADRAO_POR_TIPO.sim_nao],
    pontos_max: 10,
    obrigatoria: true,
    plano_acao_obrigatorio: false,
    permite_foto: false,
    ativo: true,
    pergunta_pai_id: "",
    resposta_pai_gatilho: "nao",
  };
}
