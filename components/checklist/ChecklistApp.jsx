"use client";
import { useState, useEffect, useRef } from "react";
import { perguntaIdPorCodigo } from "@/lib/perguntaDbIds";
import { fetchUnidades, fetchSecoes } from "@/lib/supabase";

const UUID_PERGUNTA = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const TEXTO_SUBTURNO = { manha: "Turno da manhã", tarde: "Turno da tarde" };

/** Temporário: voltar a `true` para mostrar botão + preview de foto nas perguntas. */
const EXIBIR_OPCAO_FOTO_NAS_PERGUNTAS = false;

function normalizarOpcoes(opcoes) {
  let o = opcoes;
  if (typeof o === "string") {
    try {
      o = JSON.parse(o);
    } catch {
      o = [];
    }
  }
  return Array.isArray(o) ? o : [];
}

function normalizarPerguntaParaUi(p) {
  return {
    ...p,
    opcoes: normalizarOpcoes(p.opcoes),
    obrigatoria: p.obrigatoria !== false,
    permite_foto: !!p.permite_foto,
  };
}

function normalizarSecoesDaApi(rows) {
  const lista = rows ?? [];
  return lista.map((s) => {
    const perguntasRaw = Array.isArray(s.perguntas) ? s.perguntas : [];
    const perguntas = perguntasRaw.filter((pr) => pr.ativo !== false).map(normalizarPerguntaParaUi);
    return { ...s, perguntas };
  });
}

function idPerguntaParaGravar(p) {
  const id = p?.id != null ? String(p.id) : "";
  if (UUID_PERGUNTA.test(id)) return id;
  return perguntaIdPorCodigo(p.codigo) || null;
}

/** Preserva ordem da API (grupo → nome); cada grupo aparece uma vez por ordem de chegada. */
function agruparUnidadesPorGrupo(lista) {
  const map = new Map();
  for (const u of lista) {
    const k = u.grupo ?? "";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(u);
  }
  return [...map.entries()];
}

function perguntasVisiveisNaSecao(secao, respostas) {
  return secao?.perguntas?.filter((p) => {
    if (p.tipo !== "condicional") return true;
    const pai = respostas[p.pergunta_pai_id];
    return pai?.valor === p.resposta_pai_gatilho;
  }) ?? [];
}

// ─── UTILITÁRIOS ────────────────────────────────────────────────────────────
function getScoreColor(pct) {
  if (pct >= 85) return "#16a34a";
  if (pct >= 70) return "#d97706";
  return "#dc2626";
}

function getScoreBg(pct) {
  if (pct >= 85) return "#f0fdf4";
  if (pct >= 70) return "#fffbeb";
  return "#fef2f2";
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── COMPONENTE: PERGUNTA ───────────────────────────────────────────────────
function PerguntaCard({ pergunta, resposta, onChange, perguntasPai }) {
  const [showPlanoAcao, setShowPlanoAcao] = useState(false);
  const fileRef = useRef();

  const opcaoSelecionada = pergunta.opcoes?.find(o => o.valor === resposta?.valor);
  const precisaPlanoAcao = opcaoSelecionada?.plano_acao;

  useEffect(() => {
    setShowPlanoAcao(!!precisaPlanoAcao);
  }, [precisaPlanoAcao]);

  const handleOpcao = (op) => {
    onChange({ valor: op.valor, pontos: op.pontos, comentario: resposta?.comentario || "", plano_acao: resposta?.plano_acao || "", foto_url: resposta?.foto_url || "" });
  };

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onChange({ ...resposta, foto_url: url, foto_file: file });
  };

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px", marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12 }}>
        <span style={{ background: "var(--accent-soft)", color: "var(--accent)", fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap", marginTop: 2 }}>
          {pergunta.codigo}
        </span>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5 }}>{pergunta.texto}</p>
      </div>

      {(pergunta.tipo === "sim_nao" || pergunta.tipo === "escala_3" || pergunta.tipo === "escala_5" || pergunta.tipo === "condicional") && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          {pergunta.opcoes?.map(op => (
            <button type="button" key={op.valor} onClick={() => handleOpcao(op)}
              style={{
                flex: pergunta.tipo === "escala_5" ? "1 1 calc(33% - 4px)" : "1",
                padding: "10px 8px", borderRadius: 8, border: "1.5px solid",
                fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                borderColor: resposta?.valor === op.valor ? "var(--accent)" : "var(--border)",
                background: resposta?.valor === op.valor ? "var(--accent)" : "var(--card-bg)",
                color: resposta?.valor === op.valor ? "#fff" : "var(--text-secondary)",
              }}>
              {op.label}
              {op.pontos > 0 && <span style={{ display: "block", fontSize: 11, opacity: 0.8 }}>{op.pontos}pts</span>}
            </button>
          ))}
        </div>
      )}

      {pergunta.tipo === "nota_livre" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
            <button type="button" key={n} onClick={() => onChange({ valor: String(n), pontos: 0, comentario: resposta?.comentario || "" })}
              style={{
                width: 38, height: 38, borderRadius: 8, border: "1.5px solid",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                borderColor: resposta?.valor === String(n) ? "var(--accent)" : "var(--border)",
                background: resposta?.valor === String(n) ? "var(--accent)" : "var(--card-bg)",
                color: resposta?.valor === String(n) ? "#fff" : "var(--text-secondary)",
              }}>{n}</button>
          ))}
        </div>
      )}

      {pergunta.tipo === "texto_livre" && (
        <textarea placeholder="Digite sua observação..." rows={3}
          value={resposta?.comentario || ""}
          onChange={e => onChange({ valor: e.target.value, pontos: 0, comentario: e.target.value })}
          style={{ width: "100%", borderRadius: 8, border: "1.5px solid var(--border)", padding: "10px 12px", fontSize: 14, resize: "vertical", background: "var(--card-bg)", color: "var(--text-primary)", boxSizing: "border-box" }} />
      )}

      {showPlanoAcao && (
        <div style={{ marginTop: 10, background: "#fff8f0", border: "1px solid #fed7aa", borderRadius: 8, padding: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#c2410c", display: "block", marginBottom: 6 }}>
            Plano de ação obrigatório
          </label>
          <textarea placeholder="Descreva o plano de ação..." rows={2}
            value={resposta?.plano_acao || ""}
            onChange={e => onChange({ ...resposta, plano_acao: e.target.value })}
            style={{ width: "100%", borderRadius: 6, border: "1px solid #fed7aa", padding: "8px 10px", fontSize: 13, resize: "vertical", background: "#fff", boxSizing: "border-box" }} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
        {EXIBIR_OPCAO_FOTO_NAS_PERGUNTAS && pergunta.permite_foto && (
          <>
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{ fontSize: 12, color: "var(--accent)", background: "var(--accent-soft)", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontWeight: 500 }}>
              + Foto
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFoto} />
            {resposta?.foto_url && (
              <img src={resposta.foto_url} alt="foto" style={{ height: 36, width: 36, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
            )}
          </>
        )}
        {pergunta.tipo !== "texto_livre" && pergunta.tipo !== "nota_livre" && (
          <textarea placeholder="Comentário (opcional)" rows={1}
            value={resposta?.comentario || ""}
            onChange={e => onChange({ ...resposta, comentario: e.target.value })}
            style={{ flex: 1, borderRadius: 6, border: "1px solid var(--border)", padding: "6px 10px", fontSize: 12, resize: "none", background: "var(--card-bg)", color: "var(--text-secondary)", boxSizing: "border-box" }} />
        )}
      </div>
    </div>
  );
}

// ─── COMPONENTE: BARRA DE PROGRESSO ─────────────────────────────────────────
function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color || "var(--accent)", borderRadius: 4, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 36, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

async function persistirRespostasDaSecao(avaliacao_id, sec, respostas) {
  const lista = perguntasVisiveisNaSecao(sec, respostas);
  const items = [];
  for (const p of lista) {
    const r = respostas[p.id];
    if (!r || r.valor === undefined || r.valor === "") continue;
    const pergunta_id = idPerguntaParaGravar(p);
    if (!pergunta_id) continue;
    const foto_url =
      r.foto_url && typeof r.foto_url === "string" && !r.foto_url.startsWith("blob:")
        ? r.foto_url
        : null;
    items.push({
      avaliacao_id,
      pergunta_id,
      valor: String(r.valor),
      pontos_obtidos: r.pontos ?? 0,
      comentario: r.comentario || null,
      plano_acao: r.plano_acao || null,
      foto_url,
    });
  }
  if (items.length === 0) return;
  const res = await fetch("/api/checklist/respostas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Falha ao guardar respostas.");
}

// ─── VIEW: CHECKLIST (formulário) ───────────────────────────────────────────
function ChecklistView({ userPerfil }) {
  const [step, setStep] = useState("identificacao"); // identificacao | secao | concluido
  const [secaoAtual, setSecaoAtual] = useState(0);
  const [avaliador, setAvaliador] = useState("");
  const [unidadeNome, setUnidadeNome] = useState("");
  const [turnoEscolhido, setTurnoEscolhido] = useState("manha");
  const [listaUnidades, setListaUnidades] = useState([]);
  const [unidadesLoading, setUnidadesLoading] = useState(true);
  const [unidadesErro, setUnidadesErro] = useState(null);
  const [secoesLista, setSecoesLista] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [avaliacaoId, setAvaliacaoId] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [iniciarLoading, setIniciarLoading] = useState(false);
  const [navegarLoading, setNavegarLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setUnidadesErro(null);
      setUnidadesLoading(true);
      try {
        const rows = await fetchUnidades();
        if (!cancel) setListaUnidades(rows);
      } catch (e) {
        if (!cancel) setUnidadesErro(e.message ?? "Erro ao carregar unidades.");
      } finally {
        if (!cancel) setUnidadesLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const unidadesPorGrupo = agruparUnidadesPorGrupo(listaUnidades);

  const secao = secoesLista[secaoAtual];

  const perguntasVisiveis = secao ? perguntasVisiveisNaSecao(secao, respostas) : [];

  const pontosSecao = perguntasVisiveis.reduce((acc, p) => acc + (respostas[p.id]?.pontos || 0), 0);
  const pontosMaxSecao = perguntasVisiveis.reduce((acc, p) => acc + p.pontos_max, 0);
  const totalRespondidas = perguntasVisiveis.filter(p => respostas[p.id]?.valor !== undefined && respostas[p.id]?.valor !== "").length;
  const totalObrigatorias = perguntasVisiveis.filter(p => p.obrigatoria).length;
  const respondidasObrig = perguntasVisiveis.filter(p => p.obrigatoria && respostas[p.id]?.valor !== undefined && respostas[p.id]?.valor !== "").length;

  const podeProsseguir = respondidasObrig >= totalObrigatorias;

  const handleResposta = (pId, val) => setRespostas(r => ({ ...r, [pId]: val }));

  const totalGeral = secoesLista.reduce((acc, s) => {
    return acc + (s.perguntas ?? []).filter(p => {
      if (p.tipo !== "condicional") return true;
      return respostas[p.pergunta_pai_id]?.valor === p.resposta_pai_gatilho;
    }).reduce((a, p) => a + (respostas[p.id]?.pontos || 0), 0);
  }, 0);

  const maxGeral = secoesLista.reduce((acc, s) => acc + (s.pontos_max ?? 0), 0);

  if (step === "identificacao") {
    const podeIniciar =
      Boolean(avaliador.trim() && unidadeNome.trim()) && !unidadesLoading && listaUnidades.length > 0;
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: "var(--accent)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 24 }}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12l2 2 4-4"/></svg>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Avaliação de Loja</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--text-secondary)" }}>
            {TEXTO_SUBTURNO[turnoEscolhido]} — Supervisão
          </p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!avaliador.trim() || !unidadeNome.trim()) return;
            setSyncError(null);
            setIniciarLoading(true);
            try {
              const rawSecoes = await fetchSecoes(turnoEscolhido);
              const norm = normalizarSecoesDaApi(rawSecoes);
              if (!norm.length) {
                throw new Error("Não há secções ativas para este turno.");
              }

              const res = await fetch("/api/checklist/iniciar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  avaliador_nome: avaliador.trim(),
                  unidade: unidadeNome.trim(),
                  turno: turnoEscolhido,
                  tipo_avaliador: userPerfil === "supervisor" ? "supervisor" : "gerente",
                }),
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(json.error || "Não foi possível criar a avaliação.");
              setSecoesLista(norm);
              setAvaliacaoId(json.id);
              setStep("secao");
            } catch (err) {
              console.error(err);
              setSyncError(err.message ?? "Não foi possível criar a avaliação.");
            } finally {
              setIniciarLoading(false);
            }
          }}
          style={{ display: "flex", flexDirection: "column", gap: 0 }}
        >
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Seu nome</label>
            <input value={avaliador} onChange={e => setAvaliador(e.target.value)} placeholder="Ex: Ana Costa" autoComplete="name"
              style={{ width: "100%", borderRadius: 8, border: "1.5px solid var(--border)", padding: "12px 14px", fontSize: 15, background: "var(--card-bg)", color: "var(--text-primary)", boxSizing: "border-box" }} />
          </div>

          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>Turno</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { val: "manha", label: "Manhã" },
                { val: "tarde", label: "Tarde" },
              ].map(({ val, label }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setTurnoEscolhido(val)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: 10,
                    border: "1.5px solid",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    borderColor: turnoEscolhido === val ? "var(--accent)" : "var(--border)",
                    background: turnoEscolhido === val ? "var(--accent)" : "transparent",
                    color: turnoEscolhido === val ? "#fff" : "var(--text-secondary)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Unidade</label>
            {unidadesLoading ? (
              <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>Carregando unidades...</p>
            ) : unidadesErro ? (
              <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{unidadesErro}</p>
            ) : listaUnidades.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>Sem unidades registadas na base.</p>
            ) : (
              <select
                value={unidadeNome}
                onChange={e => setUnidadeNome(e.target.value)}
                required
                style={{ width: "100%", borderRadius: 8, border: "1.5px solid var(--border)", padding: "12px 14px", fontSize: 15, background: "var(--card-bg)", color: "var(--text-primary)", boxSizing: "border-box" }}
              >
                <option value="">Selecione a unidade</option>
                {unidadesPorGrupo.map(([grupo, lista]) => (
                  <optgroup key={grupo === "" ? "_sem_grupo" : grupo} label={grupo === "" ? "—" : grupo}>
                    {lista.map((u) => (
                      <option key={`${grupo}:${u.codigo}`} value={u.nome}>
                        {u.nome}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>

          {syncError && (
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#b91c1c", lineHeight: 1.4 }}>{syncError}</p>
          )}
          <button type="submit" disabled={!podeIniciar || iniciarLoading}
            style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: podeIniciar && !iniciarLoading ? "var(--accent)" : "var(--border)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: podeIniciar && !iniciarLoading ? "pointer" : "not-allowed" }}>
            {iniciarLoading ? "A iniciar…" : "Iniciar Avaliação"}
          </button>
        </form>
      </div>
    );
  }

  if (step === "concluido") {
    const pct = maxGeral > 0 ? Math.round((totalGeral / maxGeral) * 100) : 0;
    const cor = getScoreColor(pct);
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 16px", textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: getScoreBg(pct), border: `3px solid ${cor}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 32, fontWeight: 800, color: cor }}>
          {pct}%
        </div>
        <h2 style={{ margin: "0 0 8px", color: "var(--text-primary)" }}>Avaliação concluída!</h2>
        <p style={{ color: "var(--text-secondary)", margin: "0 0 24px" }}>{totalGeral} de {maxGeral} pontos</p>

        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 24, textAlign: "left" }}>
          {secoesLista.map((s) => {
            const maxS = s.pontos_max ?? 0;
            const pts = (s.perguntas ?? []).reduce((a, p) => a + (respostas[p.id]?.pontos || 0), 0);
            const pctS = maxS > 0 ? Math.round((pts / maxS) * 100) : 0;
            return (
              <div key={s.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{s.titulo}</span>
                  <span style={{ fontSize: 13, color: getScoreColor(pctS), fontWeight: 700 }}>{pts}/{maxS}</span>
                </div>
                <ProgressBar value={pts} max={maxS || 1} color={getScoreColor(pctS)} />
              </div>
            );
          })}
        </div>

        <button type="button" onClick={() => {
          setStep("identificacao");
          setRespostas({});
          setSecaoAtual(0);
          setAvaliador("");
          setUnidadeNome("");
          setTurnoEscolhido("manha");
          setSecoesLista([]);
          setAvaliacaoId(null);
          setSyncError(null);
        }}
          style={{ width: "100%", padding: 14, borderRadius: 10, border: "1.5px solid var(--accent)", background: "transparent", color: "var(--accent)", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          Nova avaliação
        </button>
      </div>
    );
  }

  if (!secao) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px", textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Sem dados de secções. Volte e inicie a avaliação de novo.
        </p>
        <button
          type="button"
          onClick={() => {
            setStep("identificacao");
            setSecoesLista([]);
            setSecaoAtual(0);
            setAvaliacaoId(null);
            setSyncError(null);
          }}
          style={{
            marginTop: 16,
            padding: "12px 20px",
            borderRadius: 10,
            border: "1.5px solid var(--accent)",
            background: "transparent",
            color: "var(--accent)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Voltar ao início
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 540, margin: "0 auto" }}>
      {/* Header fixo com progresso */}
      <div style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)", padding: "12px 16px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Seção {secaoAtual + 1} de {secoesLista.length}</span>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{secao.titulo}</h2>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: getScoreColor(pontosMaxSecao > 0 ? Math.round((pontosSecao/pontosMaxSecao)*100) : 0) }}>{pontosSecao}</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>/{pontosMaxSecao}pts</span>
          </div>
        </div>
        {/* Progresso geral (bolinhas) */}
        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
          {secoesLista.map((s, i) => (
            <div key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, background: i < secaoAtual ? "var(--accent)" : i === secaoAtual ? "#93c5fd" : "var(--border)" }} />
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          {respondidasObrig}/{totalObrigatorias} obrigatórias respondidas
        </div>
      </div>

      {syncError && (
        <div style={{ padding: "8px 16px 0", fontSize: 13, color: "#b91c1c" }}>{syncError}</div>
      )}

      {/* Perguntas */}
      <div style={{ padding: "16px 16px 100px" }}>
        {perguntasVisiveis.map(p => (
          <PerguntaCard key={p.id} pergunta={p} resposta={respostas[p.id]}
            onChange={val => handleResposta(p.id, val)} />
        ))}
      </div>

      {/* Footer com navegação */}
      <div style={{ position: "sticky", bottom: 0, background: "var(--bg)", borderTop: "1px solid var(--border)", padding: "12px 16px", display: "flex", gap: 10 }}>
        {secaoAtual > 0 && (
          <button type="button" onClick={() => setSecaoAtual(s => s - 1)}
            style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1.5px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Anterior
          </button>
        )}
        <button
          type="button"
          onClick={async () => {
            if (!avaliacaoId) {
              setSyncError("Sessão de avaliação inválida. Volte e inicie novamente.");
              return;
            }
            setSyncError(null);
            setNavegarLoading(true);
            try {
              await persistirRespostasDaSecao(avaliacaoId, secao, respostas);
              if (secaoAtual < secoesLista.length - 1) {
                setSecaoAtual((s) => s + 1);
              } else {
                const resFim = await fetch("/api/checklist/concluir", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ avaliacao_id: avaliacaoId }),
                });
                const jsonFim = await resFim.json().catch(() => ({}));
                if (!resFim.ok) throw new Error(jsonFim.error || "Não foi possível concluir a avaliação.");
                setStep("concluido");
              }
            } catch (err) {
              console.error(err);
              setSyncError(err.message ?? "Não foi possível guardar as respostas.");
            } finally {
              setNavegarLoading(false);
            }
          }}
          disabled={!podeProsseguir || navegarLoading}
          style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: podeProsseguir && !navegarLoading ? "var(--accent)" : "var(--border)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: podeProsseguir && !navegarLoading ? "pointer" : "not-allowed" }}>
          {navegarLoading
            ? "A guardar…"
            : secaoAtual < secoesLista.length - 1
              ? "Próxima seção →"
              : "Concluir avaliação"}
        </button>
      </div>
    </div>
  );
}

function sortAvaliacoesDesc(list) {
  return [...list].sort((a, b) => {
    const ta = new Date(a.checkout_em || a.criado_em || 0).getTime();
    const tb = new Date(b.checkout_em || b.criado_em || 0).getTime();
    return tb - ta;
  });
}

function montarPorSecao(secoes, respostas) {
  const soma = new Map();
  for (const s of secoes) soma.set(s.id, 0);
  for (const r of respostas || []) {
    if (!r.secao_id || !soma.has(r.secao_id)) continue;
    soma.set(r.secao_id, (soma.get(r.secao_id) || 0) + (r.pontos_obtidos || 0));
  }
  return secoes.map((s) => {
    const obt = soma.get(s.id) || 0;
    const max = s.pontos_max || 0;
    const percentual = max > 0 ? Math.min(100, Math.round((obt / max) * 100)) : 0;
    return { secao_id: s.id, titulo: s.titulo, percentual };
  });
}

// ─── VIEW: DASHBOARD ─────────────────────────────────────────────────────────
function DashboardView({ userPerfil = "gerente" }) {
  const [tipoDashboard, setTipoDashboard] = useState(
    userPerfil === "supervisor" ? "supervisor" : "gerente"
  );
  const [filtro, setFiltro] = useState("todas");
  const [detalhe, setDetalhe] = useState(null);
  const [secoes, setSecoes] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ tipo_avaliador: tipoDashboard });
        const res = await fetch(`/api/checklist/avaliacoes?${qs}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Falha ao carregar avaliações.");
        if (cancel) return;
        const rows = json.avaliacoes ?? [];
        const sec = json.secoes ?? [];
        setAvaliacoes(rows);
        setSecoes(sec);
        const unis = [...new Set(rows.map((a) => a.unidade))];
        setFiltro((f) => (f !== "todas" && !unis.includes(f) ? "todas" : f));
        setDetalhe((d) => (d && !rows.some((a) => a.id === d.id) ? null : d));
      } catch (e) {
        if (!cancel) setError(e.message ?? "Erro ao carregar.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [tipoDashboard]);

  const unidades = [...new Set(avaliacoes.map((a) => a.unidade))].sort();
  const avaliacoesFiltradas = sortAvaliacoesDesc(
    filtro === "todas" ? avaliacoes : avaliacoes.filter((a) => a.unidade === filtro)
  );
  const mediaGeral =
    avaliacoesFiltradas.length > 0
      ? Math.round(
          avaliacoesFiltradas.reduce((a, v) => a + Number(v.percentual || 0), 0) /
            avaliacoesFiltradas.length
        )
      : 0;

  const sel =
    detalhe?.id != null ? avaliacoesFiltradas.find((a) => a.id === detalhe.id) : null;
  const displayAv = sel ?? avaliacoesFiltradas[0] ?? null;
  const porSecaoDisplay = displayAv ? montarPorSecao(secoes, displayAv.respostas) : [];

  let deltaVsAnterior = null;
  if (filtro !== "todas" && avaliacoesFiltradas.length >= 2) {
    const [atual, anterior] = avaliacoesFiltradas;
    deltaVsAnterior = Number(atual.percentual || 0) - Number(anterior.percentual || 0);
  }

  const numUnidadesKpi =
    filtro === "todas" ? unidades.length : avaliacoesFiltradas.length > 0 ? 1 : 0;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { val: "gerente", label: "Gerentes" },
          { val: "supervisor", label: "Supervisores" },
        ].map(({ val, label }) => (
          <button
            key={val}
            type="button"
            onClick={() => setTipoDashboard(val)}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1.5px solid",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              borderColor: tipoDashboard === val ? "var(--accent)" : "var(--border)",
              background: tipoDashboard === val ? "var(--accent)" : "transparent",
              color: tipoDashboard === val ? "#fff" : "var(--text-secondary)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--text-secondary)" }}>
          A carregar…
        </p>
      )}
      {error && (
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#b91c1c" }}>{error}</p>
      )}

      {!loading && !error && avaliacoes.length === 0 && (
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--text-secondary)" }}>
          Nenhuma avaliação concluída para este filtro.
        </p>
      )}

      {!loading && !error && avaliacoes.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            {[
              { label: "Média geral", value: `${mediaGeral}%`, color: getScoreColor(mediaGeral) },
              { label: "Avaliações", value: avaliacoesFiltradas.length },
              { label: "Unidades", value: numUnidadesKpi },
            ].map((k, i) => (
              <div
                key={i}
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "14px 12px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: k.color || "var(--text-primary)",
                  }}
                >
                  {k.value}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                  {k.label}
                </div>
              </div>
            ))}
          </div>

          {filtro !== "todas" && deltaVsAnterior != null && (
            <div
              style={{
                marginBottom: 16,
                padding: "10px 12px",
                borderRadius: 10,
                background: deltaVsAnterior >= 0 ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${deltaVsAnterior >= 0 ? "#86efac" : "#fecaca"}`,
                fontSize: 13,
                color: "var(--text-primary)",
              }}
            >
              <strong>Vs. avaliação anterior</strong> (mesma unidade):{" "}
              <span
                style={{
                  fontWeight: 700,
                  color: deltaVsAnterior >= 0 ? "#15803d" : "#b91c1c",
                }}
              >
                {deltaVsAnterior >= 0 ? "+" : ""}
                {deltaVsAnterior.toFixed(1)} p.p. no percentual global
              </span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 16,
              overflowX: "auto",
              paddingBottom: 4,
            }}
          >
            {["todas", ...unidades].map((u) => (
              <button
                type="button"
                key={u}
                onClick={() => {
                  setFiltro(u);
                  setDetalhe(null);
                }}
                style={{
                  whiteSpace: "nowrap",
                  padding: "7px 14px",
                  borderRadius: 20,
                  border: "1.5px solid",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  borderColor: filtro === u ? "var(--accent)" : "var(--border)",
                  background: filtro === u ? "var(--accent)" : "transparent",
                  color: filtro === u ? "#fff" : "var(--text-secondary)",
                }}
              >
                {u === "todas" ? "Todas as unidades" : u}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {avaliacoesFiltradas.map((av) => {
              const ativo = displayAv?.id === av.id;
              return (
                <button
                  type="button"
                  key={av.id}
                  onClick={() => setDetalhe(av)}
                  style={{
                    background: ativo ? "var(--accent-soft)" : "var(--card-bg)",
                    border: `1.5px solid ${ativo ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: 14,
                    padding: "16px",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "var(--text-primary)",
                          marginBottom: 2,
                        }}
                      >
                        {av.unidade}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {av.avaliador_nome} · {formatDate(av.checkout_em || av.criado_em)}
                      </div>
                    </div>
                    <div
                      style={{
                        background: getScoreBg(av.percentual),
                        border: `1.5px solid ${getScoreColor(av.percentual)}`,
                        borderRadius: 8,
                        padding: "6px 12px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: getScoreColor(av.percentual),
                        }}
                      >
                        {Math.round(Number(av.percentual || 0))}%
                      </span>
                    </div>
                  </div>
                  <ProgressBar
                    value={Number(av.percentual || 0)}
                    max={100}
                    color={getScoreColor(av.percentual)}
                  />
                </button>
              );
            })}
          </div>

          {displayAv && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>
                  Detalhe {detalhe ? "" : "(última concluída)"}
                </h2>
                {detalhe && (
                  <button
                    type="button"
                    onClick={() => setDetalhe(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Ver última
                  </button>
                )}
              </div>
              <div
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 20,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 18, color: "var(--text-primary)" }}>
                      {displayAv.unidade}
                    </h3>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                      {displayAv.avaliador_nome} ·{" "}
                      {formatDate(displayAv.checkout_em || displayAv.criado_em)}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color: getScoreColor(displayAv.percentual),
                      }}
                    >
                      {Math.round(Number(displayAv.percentual || 0))}%
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {displayAv.nota_total != null && displayAv.nota_maxima != null
                        ? `${displayAv.nota_total}/${displayAv.nota_maxima} pts`
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 20,
                }}
              >
                <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "var(--text-primary)" }}>
                  Resultado por seção
                </h3>
                {porSecaoDisplay.map((s) => (
                  <div key={s.secao_id} style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          color: "var(--text-primary)",
                          fontWeight: 500,
                        }}
                      >
                        {s.titulo}
                      </span>
                      <span
                        style={{ fontSize: 14, fontWeight: 700, color: getScoreColor(s.percentual) }}
                      >
                        {s.percentual}%
                      </span>
                    </div>
                    <ProgressBar
                      value={s.percentual}
                      max={100}
                      color={getScoreColor(s.percentual)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── APP PRINCIPAL ───────────────────────────────────────────────────────────
export default function ChecklistApp({ userPerfil = "supervisor" }) {
  const [aba, setAba] = useState("checklist");
  const podeVerAnalise = userPerfil === "supervisor" || userPerfil === "admin";

  return (
    <div style={{
      "--accent": "#0ea5e9",
      "--accent-soft": "#e0f2fe",
      "--bg": "var(--color-background-primary, #fff)",
      "--card-bg": "var(--color-background-secondary, #f8fafc)",
      "--border": "var(--color-border-tertiary, #e2e8f0)",
      "--text-primary": "var(--color-text-primary, #0f172a)",
      "--text-secondary": "var(--color-text-secondary, #64748b)",
      fontFamily: "var(--font-sans, system-ui, sans-serif)",
      minHeight: "100vh",
      background: "var(--bg)",
    }}>
      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg)", position: "sticky", top: 0, zIndex: 20 }}>
        <button type="button" onClick={() => setAba("checklist")}
          style={{ flex: 1, padding: "14px 0", border: "none", background: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
            color: aba === "checklist" ? "var(--accent)" : "var(--text-secondary)",
            borderBottom: aba === "checklist" ? "2.5px solid var(--accent)" : "2.5px solid transparent" }}>
          Checklist
        </button>
        {podeVerAnalise && (
          <button type="button" onClick={() => setAba("dashboard")}
            style={{ flex: 1, padding: "14px 0", border: "none", background: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
              color: aba === "dashboard" ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: aba === "dashboard" ? "2.5px solid var(--accent)" : "2.5px solid transparent" }}>
            Análise
          </button>
        )}
      </div>

      {aba === "checklist" ? (
        <ChecklistView userPerfil={userPerfil} />
      ) : (
        <DashboardView userPerfil={userPerfil} />
      )}
    </div>
  );
}
