/**
 * one-time: teste E2E de sinalizações pendentes via API local.
 * Uso: node scripts/one-time/test-sinalizacoes-e2e.mjs
 */
const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const LOJA = `TESTE SINALIZACAO E2E ${Date.now()}`;

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, json };
}

function log(step, data) {
  console.log(`\n=== ${step} ===`);
  console.log(JSON.stringify(data, null, 2));
}

async function iniciarAvaliacao(nome) {
  const r = await req("POST", "/api/checklist/iniciar", {
    avaliador_nome: nome,
    unidade: LOJA,
    turno: "tarde",
    tipo_avaliador: "supervisor",
    uid: "e2e-test-sinalizacao",
  });
  if (!r.ok) throw new Error(`iniciar falhou: ${JSON.stringify(r.json)}`);
  return r.json.id;
}

async function main() {
  console.log("BASE:", BASE);
  console.log("LOJA:", LOJA);

  // Descobrir uma pergunta_id real
  const secoes = await req("GET", "/api/checklist/secoes?turno=tarde");
  log("GET secoes", { status: secoes.status, count: secoes.json?.secoes?.length ?? secoes.json?.length });
  const lista = secoes.json?.secoes ?? secoes.json ?? [];
  let perguntaId = null;
  for (const s of lista) {
    const p = (s.perguntas || []).find((x) => x?.id);
    if (p) {
      perguntaId = p.id;
      break;
    }
  }
  if (!perguntaId) {
    // fallback: listar via historico de alguma avaliação
    throw new Error("Nenhuma pergunta encontrada em /api/checklist/secoes?turno=tarde");
  }
  console.log("pergunta_id:", perguntaId);

  // --- Passo 1: criar avaliação + concluir com sinalizar_comentario ---
  const id1 = await iniciarAvaliacao("E2E Sinalizar 1");
  log("iniciar #1", { id: id1 });

  // grava resposta com comentario (para fallback no backend também)
  const resp1 = await req("POST", "/api/checklist/respostas", {
    items: [
      {
        avaliacao_id: id1,
        pergunta_id: perguntaId,
        valor: "nao",
        pontos_obtidos: 0,
        comentario: "Comentario E2E: geladeira barulhenta",
        plano_acao: null,
        foto_url: null,
      },
    ],
  });
  log("POST respostas #1", { status: resp1.status, json: resp1.json });

  const conc1 = await req("POST", "/api/checklist/concluir", {
    avaliacao_id: id1,
    items: [
      {
        pergunta_id: perguntaId,
        comentario: "Comentario E2E: geladeira barulhenta",
        sinalizar_comentario: true,
        sinalizar_plano_acao: false,
        verificacao_comentario: null,
        verificacao_plano_acao: null,
      },
    ],
  });
  log("POST concluir #1 (sinalizar)", { status: conc1.status, json: conc1.json });

  // --- Passo 2: GET pendências ---
  const get1 = await req(
    "GET",
    `/api/checklist/sinalizacoes?loja=${encodeURIComponent(LOJA)}`
  );
  log("GET sinalizacoes apos sinalizar", { status: get1.status, json: get1.json });

  const pend1 = (get1.json.pendencias || []).find(
    (p) => p.pergunta_id === perguntaId && p.tipo_campo === "comentario"
  );
  const ok2 =
    !!pend1 &&
    (pend1.vezes_nao_resolvido === 0 || pend1.vezes_nao_resolvido === "0") &&
    String(pend1.texto_original || "").includes("geladeira");
  console.log("CHECK passo2:", ok2 ? "PASS" : "FAIL", {
    found: !!pend1,
    vezes: pend1?.vezes_nao_resolvido,
    texto: pend1?.texto_original,
  });

  // --- Passo 3: segunda avaliação, verificacao nao ---
  const id2 = await iniciarAvaliacao("E2E Verificar Nao");
  log("iniciar #2", { id: id2 });

  const conc2 = await req("POST", "/api/checklist/concluir", {
    avaliacao_id: id2,
    items: [
      {
        pergunta_id: perguntaId,
        verificacao_comentario: "nao",
        motivo_comentario: "Ainda aguardando peca de reposicao",
      },
    ],
  });
  log("POST concluir #2 (nao resolvido)", { status: conc2.status, json: conc2.json });

  // --- Passo 4: GET de novo ---
  const get2 = await req(
    "GET",
    `/api/checklist/sinalizacoes?loja=${encodeURIComponent(LOJA)}`
  );
  log("GET sinalizacoes apos nao", { status: get2.status, json: get2.json });

  const pend2 = (get2.json.pendencias || []).find(
    (p) => p.pergunta_id === perguntaId && p.tipo_campo === "comentario"
  );
  const hist = pend2?.historico_motivos_nao || [];
  const ok4 =
    !!pend2 &&
    Number(pend2.vezes_nao_resolvido) === 1 &&
    hist.some((h) => String(h.motivo || "").includes("peca"));
  console.log("CHECK passo4:", ok4 ? "PASS" : "FAIL", {
    vezes: pend2?.vezes_nao_resolvido,
    histLen: hist.length,
    hist,
  });

  // --- Passo 5: terceira avaliação, verificacao sim ---
  const id3 = await iniciarAvaliacao("E2E Verificar Sim");
  log("iniciar #3", { id: id3 });

  const conc3 = await req("POST", "/api/checklist/concluir", {
    avaliacao_id: id3,
    items: [
      {
        pergunta_id: perguntaId,
        verificacao_comentario: "sim",
      },
    ],
  });
  log("POST concluir #3 (resolvido)", { status: conc3.status, json: conc3.json });

  const get3 = await req(
    "GET",
    `/api/checklist/sinalizacoes?loja=${encodeURIComponent(LOJA)}`
  );
  log("GET sinalizacoes apos sim", { status: get3.status, json: get3.json });

  const pend3 = (get3.json.pendencias || []).find(
    (p) => p.pergunta_id === perguntaId && p.tipo_campo === "comentario"
  );
  const ok5 = !pend3;
  console.log("CHECK passo5:", ok5 ? "PASS" : "FAIL", {
    stillPresent: !!pend3,
    count: (get3.json.pendencias || []).length,
  });

  console.log("\n===== RESUMO =====");
  console.log({
    passo2_pendencia_criada: ok2,
    passo4_contador_e_historico: ok4,
    passo5_resolvida_sumiu: ok5,
    allPass: ok2 && ok4 && ok5,
  });

  if (!(ok2 && ok4 && ok5)) process.exitCode = 1;
}

main().catch((e) => {
  console.error("ERRO FATAL:", e);
  process.exit(1);
});
