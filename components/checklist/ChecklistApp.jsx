"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { perguntaIdPorCodigo } from "@/lib/perguntaDbIds";
import { perguntaEstaAtiva } from "@/lib/checklist-queries";
import { turnoModeloPorTipoAvaliador, mapRespostasParaApi } from "@/lib/avaliacoes-resposta-map";
import { fetchSecoes, uploadFoto } from "@/lib/supabase";
import AdminPerguntasModal from "./AdminPerguntasModal";

const UUID_PERGUNTA = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const TEXTO_SUBTURNO = { manha: "Turno da manhã", tarde: "Turno da tarde" };

const TEXTO_TURNO_LISTA = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };

function textoTurnoLista(t) {
  if (t == null || t === "") return "—";
  return TEXTO_TURNO_LISTA[t] ?? String(t);
}

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
    const perguntas = perguntasRaw.filter(perguntaEstaAtiva).map(normalizarPerguntaParaUi);
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

function respostasFormParaDetalheExibicao(secoesLista, estadoRespostas) {
  const rows = [];
  for (const sec of secoesLista ?? []) {
    for (const p of perguntasVisiveisNaSecao(sec, estadoRespostas)) {
      const r = estadoRespostas[p.id];
      if (!r || r.valor === undefined || r.valor === "") continue;
      const foto =
        r.foto_url && typeof r.foto_url === "string" && !r.foto_url.startsWith("blob:")
          ? r.foto_url
          : null;
      rows.push({
        pergunta_id: idPerguntaParaGravar(p) || p.id,
        valor: String(r.valor),
        pontos_obtidos: r.pontos ?? 0,
        comentario: r.comentario || null,
        plano_acao: r.plano_acao || null,
        foto_url: foto,
        perguntas: {
          secao_id: sec.id,
          texto: p.texto,
          codigo: p.codigo,
          tipo: p.tipo,
          opcoes: p.opcoes,
        },
      });
    }
  }
  return mapRespostasParaApi(rows);
}

/** Respostas do formulário no formato consumido por `montarPorSecao` (como no histórico). */
function respostasFormParaMontarPorSecao(secoesLista, estadoRespostas) {
  const out = [];
  for (const sec of secoesLista ?? []) {
    for (const p of perguntasVisiveisNaSecao(sec, estadoRespostas)) {
      const r = estadoRespostas[p.id];
      if (!r || r.valor === undefined || r.valor === "") continue;
      out.push({
        secao_id: sec.id,
        pontos_obtidos: Number(r.pontos) || 0,
      });
    }
  }
  return out;
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

function formatDateTimePt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function eliminarAvaliacaoApi(avaliacao_id) {
  const res = await fetch("/api/checklist/avaliacao", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ avaliacao_id }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Falha ao eliminar a avaliação.");
}

async function atualizarUnidadeAvaliacaoApi(avaliacao_id, unidade) {
  const res = await fetch("/api/checklist/avaliacao", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ avaliacao_id, unidade: String(unidade).trim() }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Falha ao actualizar a loja.");
}

/** Resposta da API → estado do formulário por `pergunta.id`. */
function respostasPersistidasParaEstado(rows) {
  const estado = {};
  for (const r of rows ?? []) {
    const pid = r.pergunta_id != null ? String(r.pergunta_id) : "";
    if (!pid) continue;
    estado[pid] = {
      valor: r.valor != null && r.valor !== "" ? String(r.valor) : "",
      pontos: Number(r.pontos_obtidos) || 0,
      comentario: r.comentario ?? "",
      plano_acao: r.plano_acao ?? "",
      foto_url: r.foto_url ?? "",
    };
  }
  return estado;
}

// ─── COMPONENTE: PERGUNTA ───────────────────────────────────────────────────
function PerguntaCard({ pergunta, resposta, onChange, avaliacaoId }) {
  const [showPlanoAcao, setShowPlanoAcao] = useState(false);
  const [fotoLoading, setFotoLoading] = useState(false);
  const [fotoErro, setFotoErro] = useState(null);
  const fileRef = useRef(null);
  const previewBlobRef = useRef(null);

  const opcaoSelecionada = pergunta.opcoes?.find(o => o.valor === resposta?.valor);
  const precisaPlanoAcao = opcaoSelecionada?.plano_acao;
  const isNaoConsta = resposta?.valor === "nao_consta";

  useEffect(() => {
    setShowPlanoAcao(!!precisaPlanoAcao);
  }, [precisaPlanoAcao]);

  const revogarPreviewBlob = () => {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }
  };

  useEffect(() => () => revogarPreviewBlob(), []);

  const handleOpcao = (op) => {
    const payload = {
      valor: op.valor,
      pontos: op.pontos,
      comentario: resposta?.comentario || "",
      plano_acao: resposta?.plano_acao || "",
      foto_url: resposta?.foto_url || "",
    };
    if (op.valor === "nao_consta") {
      payload.pontos_max_override = 0;
    }
    onChange(payload);
  };

  const handleFoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!avaliacaoId) {
      setFotoErro("Inicie a avaliação antes de enviar fotos.");
      return;
    }

    const perguntaId = idPerguntaParaGravar(pergunta);
    if (!perguntaId) {
      setFotoErro("Não foi possível identificar esta pergunta.");
      return;
    }

    const fotoAnterior =
      resposta?.foto_url && !String(resposta.foto_url).startsWith("blob:")
        ? resposta.foto_url
        : "";

    setFotoErro(null);
    setFotoLoading(true);
    revogarPreviewBlob();
    const localPreview = URL.createObjectURL(file);
    previewBlobRef.current = localPreview;
    onChange({ ...resposta, foto_url: localPreview });

    try {
      const publicUrl = await uploadFoto(file, avaliacaoId, perguntaId);
      revogarPreviewBlob();
      onChange({ ...resposta, foto_url: publicUrl });
    } catch (err) {
      revogarPreviewBlob();
      onChange({ ...resposta, foto_url: fotoAnterior });
      setFotoErro(err?.message ?? "Falha ao enviar a foto.");
    } finally {
      setFotoLoading(false);
    }
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
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8, opacity: isNaoConsta ? 0.45 : 1 }}>
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
          {pergunta.permite_nao_consta && (
            <>
              <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0 12px" }} />
              <button
                type="button"
                onClick={() => handleOpcao({ valor: "nao_consta", pontos: 0, label: "Não consta" })}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1.5px solid",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  marginBottom: 8,
                  borderColor: isNaoConsta ? "var(--accent)" : "var(--border)",
                  background: isNaoConsta ? "var(--accent)" : "transparent",
                  color: isNaoConsta ? "#fff" : "var(--text-secondary)",
                }}
              >
                Não consta
              </button>
            </>
          )}
        </>
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

      {pergunta.permite_foto && (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            disabled={fotoLoading}
            onClick={() => fileRef.current?.click()}
            style={{
              fontSize: 13,
              color: "var(--accent)",
              background: "var(--accent-soft)",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: fotoLoading ? "wait" : "pointer",
              fontWeight: 600,
              opacity: fotoLoading ? 0.7 : 1,
            }}
          >
            {fotoLoading ? "A enviar foto…" : "📷 Adicionar foto"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleFoto}
          />
          {fotoErro && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#b91c1c" }}>{fotoErro}</p>
          )}
          {resposta?.foto_url && (
            <img
              src={resposta.foto_url}
              alt="Foto da pergunta"
              style={{
                display: "block",
                marginTop: 10,
                maxWidth: "100%",
                width: 120,
                height: 120,
                objectFit: "cover",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            />
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
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

function FotoRespostaVisualizacao({ fotoUrl }) {
  const [ampliada, setAmpliada] = useState(false);
  const url = fotoUrl != null ? String(fotoUrl).trim() : "";
  if (!url || url.startsWith("blob:")) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAmpliada(true)}
        style={{
          display: "block",
          marginTop: 8,
          padding: 0,
          border: "none",
          background: "none",
          cursor: "pointer",
        }}
        aria-label="Ver foto em tamanho maior"
      >
        <img
          src={url}
          alt="Foto da resposta"
          style={{
            width: 80,
            height: 80,
            objectFit: "cover",
            borderRadius: 8,
            border: "1px solid var(--border)",
          }}
        />
      </button>
      {ampliada && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setAmpliada(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(15, 23, 42, 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <button
            type="button"
            onClick={() => setAmpliada(false)}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              border: "none",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: 28,
              lineHeight: 1,
              width: 40,
              height: 40,
              borderRadius: 8,
              cursor: "pointer",
            }}
            aria-label="Fechar"
          >
            ×
          </button>
          <img
            src={url}
            alt="Foto da resposta"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "100%",
              maxHeight: "90vh",
              borderRadius: 8,
              objectFit: "contain",
            }}
          />
        </div>
      )}
    </>
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

/** Resultado por seção com acordeão: perguntas e respostas da avaliação (Análise / histórico). */
function ResultadoPorSecaoExpandivel({ linhasPorSecao, respostas, avaliacaoKey }) {
  const [abertas, setAbertas] = useState(() => new Set());

  useEffect(() => {
    setAbertas(new Set());
  }, [avaliacaoKey]);

  const porSecaoRespostas = useMemo(() => {
    const m = new Map();
    for (const r of respostas ?? []) {
      const sid = r.secao_id;
      if (sid == null) continue;
      const k = String(sid);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) =>
        String(a.pergunta_codigo ?? "").localeCompare(String(b.pergunta_codigo ?? ""), "pt", {
          sensitivity: "base",
          numeric: true,
        })
      );
    }
    return m;
  }, [respostas]);

  function toggle(secaoId) {
    const id = String(secaoId);
    setAbertas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
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
      {linhasPorSecao.map((s) => {
        const sid = String(s.secao_id);
        const open = abertas.has(sid);
        const perguntasLista = porSecaoRespostas.get(sid) ?? [];
        return (
          <div key={s.secao_id} style={{ marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => toggle(s.secao_id)}
              style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                gap: 8,
                padding: "8px 4px",
                marginBottom: 6,
                border: "none",
                background: open ? "var(--accent-soft)" : "transparent",
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 12, width: 18, color: "var(--text-secondary)" }}>
                {open ? "▼" : "▶"}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: "var(--text-primary)",
                  fontWeight: 600,
                }}
              >
                {s.titulo}
              </span>
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: getScoreColor(s.percentual),
                  }}
                >
                  {s.percentual}%
                </span>
                {s.pontos_max_secao != null && (
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {s.pontos_obtidos_secao ?? 0}/{s.pontos_max_secao} pts
                  </span>
                )}
              </span>
            </button>
            <div style={{ paddingLeft: 26 }}>
              <ProgressBar
                value={s.percentual}
                max={100}
                color={getScoreColor(s.percentual)}
              />
            </div>
            {open && (
              <div
                style={{
                  marginTop: 10,
                  marginLeft: 18,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                }}
              >
                {perguntasLista.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                    Sem respostas registadas nesta seção.
                  </p>
                ) : (
                  perguntasLista.map((r, idx) => (
                    <div
                      key={`${r.pergunta_id}-${idx}`}
                      style={{
                        paddingBottom: idx < perguntasLista.length - 1 ? 14 : 0,
                        marginBottom: idx < perguntasLista.length - 1 ? 14 : 0,
                        borderBottom:
                          idx < perguntasLista.length - 1 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "flex-start",
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--accent)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.pergunta_codigo || "—"}
                        </span>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            color: "var(--text-primary)",
                            lineHeight: 1.45,
                          }}
                        >
                          {r.pergunta_texto || "Pergunta"}
                        </p>
                      </div>
                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {r.resposta_exibicao ?? r.resposta_label ?? "—"}
                      </p>
                      {r.pergunta_tipo !== "texto_livre" &&
                        r.pergunta_tipo !== "nota_livre" &&
                        r.comentario && (
                          <p
                            style={{
                              margin: "6px 0 0",
                              fontSize: 12,
                              color: "var(--text-secondary)",
                            }}
                          >
                            Comentário: {r.comentario}
                          </p>
                        )}
                      {r.plano_acao && (
                        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#c2410c" }}>
                          Plano de ação: {r.plano_acao}
                        </p>
                      )}
                      <FotoRespostaVisualizacao fotoUrl={r.foto_url} />
                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: 11,
                          color: "var(--text-secondary)",
                        }}
                      >
                        +{r.pontos_obtidos} pts
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
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
      pontos_max: String(r.valor) === "nao_consta" ? 0 : (Number(p.pontos_max) || 0),
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
function ChecklistView({ userPerfil, uid }) {
  const [step, setStep] = useState("identificacao"); // identificacao | historico | secao | concluido
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
  const [adminModoChecklist, setAdminModoChecklist] = useState("supervisor"); // supervisor | gerente — só usa quando userPerfil === "admin"
  const [modalSairOpen, setModalSairOpen] = useState(false);
  const [modalContinuar, setModalContinuar] = useState({ open: false, avaliacao: null });
  const [toastAviso, setToastAviso] = useState("");
  const [historicoLista, setHistoricoLista] = useState([]);
  const [historicoSecoes, setHistoricoSecoes] = useState([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoError, setHistoricoError] = useState(null);
  const [historicoDetalhe, setHistoricoDetalhe] = useState(null);
  const [conclusaoVerRespostasDetalhe, setConclusaoVerRespostasDetalhe] = useState(false);
  const [historicoFiltroUnidade, setHistoricoFiltroUnidade] = useState("");
  const [listaUnidadesHistorico, setListaUnidadesHistorico] = useState([]);
  const [historicoUnidadesLoading, setHistoricoUnidadesLoading] = useState(false);
  const [historicoAccordionOpen, setHistoricoAccordionOpen] = useState(false);
  const [historicoRefreshKey, setHistoricoRefreshKey] = useState(0);
  const [histEditModal, setHistEditModal] = useState(null);
  const [histEditDraft, setHistEditDraft] = useState("");
  const [histDelModal, setHistDelModal] = useState(null);
  const [histUnidList, setHistUnidList] = useState([]);
  const [histUnidLoading, setHistUnidLoading] = useState(false);
  const [histOpLoading, setHistOpLoading] = useState(false);
  const [histOpError, setHistOpError] = useState(null);
  /** Nota global gravada na BD após concluir (fonte da verdade: função SQL). */
  const [notaConclusaoBd, setNotaConclusaoBd] = useState(null);

  const atuaComoSupervisor =
    userPerfil === "supervisor" ||
    (userPerfil === "admin" && adminModoChecklist === "supervisor");
  const podeVerHistoricoAvaliacoes = atuaComoSupervisor || uid != null;

  useEffect(() => {
    if (step !== "historico") return;
    let cancel = false;
    if (!atuaComoSupervisor && uid == null) return;
    (async () => {
      setHistoricoLoading(true);
      setHistoricoError(null);
      try {
        const params = new URLSearchParams();
        if (atuaComoSupervisor) {
          params.set("perfil", "supervisor");
        } else {
          params.set("perfil", "gerente");
          params.set("uid", String(uid));
        }
        const u = historicoFiltroUnidade.trim();
        if (u) params.set("unidade", u);
        const res = await fetch(`/api/checklist/avaliacoes/historico?${params}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Falha ao carregar histórico.");
        if (cancel) return;
        setHistoricoLista(json.avaliacoes ?? []);
        setHistoricoSecoes(json.secoes ?? []);
      } catch (e) {
        if (!cancel) setHistoricoError(e.message ?? "Erro ao carregar histórico.");
      } finally {
        if (!cancel) setHistoricoLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [step, uid, atuaComoSupervisor, historicoFiltroUnidade, historicoRefreshKey]);

  useEffect(() => {
    setHistoricoAccordionOpen(false);
  }, [historicoFiltroUnidade]);

  useEffect(() => {
    if (!histEditModal) return;
    let cancel = false;
    (async () => {
      setHistUnidLoading(true);
      try {
        const res = await fetch("/api/checklist/unidades?perfil=supervisor");
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Falha ao carregar lojas.");
        if (!cancel) setHistUnidList(json.unidades ?? []);
      } catch {
        if (!cancel) setHistUnidList([]);
      } finally {
        if (!cancel) setHistUnidLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [histEditModal?.id]);

  useEffect(() => {
    if (histEditModal) setHistEditDraft(histEditModal.unidade ?? "");
  }, [histEditModal?.id]);

  useEffect(() => {
    if (step !== "historico") return;
    if (!atuaComoSupervisor && uid == null) return;
    let cancel = false;
    (async () => {
      setHistoricoUnidadesLoading(true);
      try {
        const qs = new URLSearchParams();
        if (atuaComoSupervisor) {
          qs.set("perfil", "supervisor");
        } else {
          qs.set("perfil", "gerente");
          qs.set("uid", String(uid));
        }
        const res = await fetch(`/api/checklist/unidades?${qs}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "Erro ao carregar lojas.");
        if (!cancel) setListaUnidadesHistorico(json.unidades ?? []);
      } catch (e) {
        if (!cancel) setListaUnidadesHistorico([]);
      } finally {
        if (!cancel) setHistoricoUnidadesLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [step, uid, atuaComoSupervisor]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setUnidadesErro(null);
      setUnidadesLoading(true);
      try {
        const qs = new URLSearchParams({ perfil: userPerfil });
        if (uid != null) qs.set("uid", String(uid));
        const res = await fetch(`/api/checklist/unidades?${qs}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "Erro ao carregar unidades.");
        const rows = json.unidades ?? [];
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
  }, [userPerfil, uid]);

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

  const voltarAoInicioChecklist = () => {
    setStep("identificacao");
    setSecaoAtual(0);
    setSecoesLista([]);
    setRespostas({});
    setAvaliacaoId(null);
    setSyncError(null);
    setModalSairOpen(false);
    setNotaConclusaoBd(null);
  };

  async function iniciarNovaAvaliacao() {
    const turnoParaBusca = "tarde";
    const rawSecoes = await fetchSecoes(turnoParaBusca);
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
        tipo_avaliador: atuaComoSupervisor ? "supervisor" : "gerente",
        uid: uid ?? null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Não foi possível criar a avaliação.");
    setNotaConclusaoBd(null);
    setSecoesLista(norm);
    setRespostas({});
    setAvaliacaoId(json.id);
    setSecaoAtual(0);
    setToastAviso("");
    setStep("secao");
  }

  const historicoSecoesParaMontagem =
    historicoDetalhe == null
      ? []
      : secoesComRespostasParaMontar(
          historicoSecoes,
          historicoDetalhe.respostas,
          turnoModeloPorTipoAvaliador(historicoDetalhe.tipo_avaliador)
        );
  const porSecaoHistorico =
    historicoDetalhe && historicoSecoesParaMontagem.length
      ? montarPorSecao(historicoSecoesParaMontagem, historicoDetalhe.respostas)
      : [];

  const unidadesHistoricoPorGrupo = agruparUnidadesPorGrupo(listaUnidadesHistorico);

  const historicoBackPill = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    minHeight: 44,
    padding: "0 14px 0 10px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card-bg)",
    color: "var(--text-primary)",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(15,23,42,0.08)",
  };

  const podeGestionarHistoricoLista = userPerfil === "admin" || userPerfil === "supervisor";

  function refreshHistoricoLista() {
    setHistoricoRefreshKey((k) => k + 1);
  }

  async function historicoOpEliminarConfirm() {
    if (!histDelModal) return;
    const id = histDelModal.id;
    setHistOpError(null);
    setHistOpLoading(true);
    try {
      await eliminarAvaliacaoApi(id);
      setHistDelModal(null);
      if (historicoDetalhe?.id === id) setHistoricoDetalhe(null);
      refreshHistoricoLista();
    } catch (e) {
      setHistOpError(e.message ?? "Erro ao eliminar.");
    } finally {
      setHistOpLoading(false);
    }
  }

  async function historicoOpSalvarUnidade() {
    if (!histEditModal || !histEditDraft.trim()) return;
    const id = histEditModal.id;
    const unidade = histEditDraft.trim();
    setHistOpError(null);
    setHistOpLoading(true);
    try {
      await atualizarUnidadeAvaliacaoApi(id, unidade);
      setHistEditModal(null);
      refreshHistoricoLista();
      if (historicoDetalhe?.id === id) {
        setHistoricoDetalhe((d) => (d ? { ...d, unidade } : d));
      }
    } catch (e) {
      setHistOpError(e.message ?? "Erro ao guardar.");
    } finally {
      setHistOpLoading(false);
    }
  }

  function renderHistoricoLinhaAvaliacao(av) {
    return (
      <div
        key={av.id}
        style={{
          display: "flex",
          gap: 8,
          alignItems: "stretch",
          width: "100%",
        }}
      >
        <button
          type="button"
          onClick={() => setHistoricoDetalhe(av)}
          style={{
            flex: 1,
            minWidth: 0,
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "16px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 8,
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: 4,
                }}
              >
                {formatDate(av.checkout_em || av.criado_em)} ·{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                  {textoTurnoLista(av.turno)}
                </span>
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {av.unidade}
              </div>
              {atuaComoSupervisor && (
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background:
                      av.tipo_avaliador === "supervisor"
                        ? "#e0f2fe"
                        : "var(--accent-soft)",
                    color:
                      av.tipo_avaliador === "supervisor"
                        ? "#0369a1"
                        : "var(--accent)",
                  }}
                >
                  {av.tipo_avaliador === "supervisor" ? "Supervisão" : "Gerente"}
                </span>
              )}
            </div>
            <div
              style={{
                background: getScoreBg(av.percentual),
                border: `1.5px solid ${getScoreColor(av.percentual)}`,
                borderRadius: 8,
                padding: "6px 12px",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: 17,
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
        {podeGestionarHistoricoLista ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 6,
              flexShrink: 0,
              padding: "4px 0",
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setHistOpError(null);
                setHistEditModal(av);
                setHistEditDraft(av.unidade ?? "");
              }}
              style={{
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--card-bg)",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setHistOpError(null);
                setHistDelModal(av);
              }}
              style={{
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#b91c1c",
                cursor: "pointer",
              }}
            >
              Eliminar
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (step === "historico") {
    const pctGlob = historicoDetalhe
      ? Math.round(Number(historicoDetalhe.percentual ?? 0))
      : 0;
    const histSorted = sortAvaliacoesDesc(historicoLista);
    const histRecent = histSorted[0] ?? null;
    const histOlder = histSorted.slice(1);

    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        {!historicoDetalhe && (
          <>
            <button
              type="button"
              aria-label="Voltar"
              onClick={() => {
                setHistoricoDetalhe(null);
                setStep("identificacao");
              }}
              style={{ ...historicoBackPill, marginBottom: 16 }}
            >
              <span style={{ fontSize: 26, lineHeight: 1, fontWeight: 400 }} aria-hidden>
                ‹
              </span>
              Voltar
            </button>
            <h1
              style={{
                margin: "0 0 8px",
                fontSize: 20,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Minhas avaliações
            </h1>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--text-secondary)" }}>
              Avaliações concluídas, da mais recente à mais antiga.
            </p>
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Loja
              </label>
              {historicoUnidadesLoading ? (
                <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>
                  A carregar lojas…
                </p>
              ) : (
                <select
                  value={historicoFiltroUnidade}
                  onChange={(e) => setHistoricoFiltroUnidade(e.target.value)}
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    padding: "12px 14px",
                    fontSize: 15,
                    background: "var(--card-bg)",
                    color: "var(--text-primary)",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="">Todas as lojas</option>
                  {unidadesHistoricoPorGrupo.map(([grupo, lista]) => (
                    <optgroup key={grupo === "" ? "_sem_grupo_h" : grupo} label={grupo === "" ? "—" : grupo}>
                      {lista.map((u) => (
                        <option key={`hist:${grupo}:${u.codigo}`} value={u.nome}>
                          {u.nome}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </div>
            {historicoLoading && (
              <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>
                A carregar…
              </p>
            )}
            {historicoError && (
              <p style={{ margin: "0 0 16px", fontSize: 14, color: "#b91c1c" }}>
                {historicoError}
              </p>
            )}
            {!historicoLoading && !historicoError && historicoLista.length === 0 && (
              <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>
                Sem avaliações concluídas.
              </p>
            )}
            {!historicoLoading && !historicoError && historicoLista.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {histOpError && !histDelModal && !histEditModal && (
                  <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{histOpError}</p>
                )}
                {histRecent && renderHistoricoLinhaAvaliacao(histRecent)}
                {histOlder.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setHistoricoAccordionOpen((o) => !o)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--card-bg)",
                        color: "var(--text-primary)",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span>Avaliações anteriores ({histOlder.length})</span>
                      <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>
                        {historicoAccordionOpen ? "▲" : "▼"}
                      </span>
                    </button>
                    {historicoAccordionOpen && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                          marginTop: 10,
                          paddingLeft: 4,
                          borderLeft: "2px solid var(--border)",
                        }}
                      >
                        {histOlder.map((av) => renderHistoricoLinhaAvaliacao(av))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {historicoDetalhe && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <button
                type="button"
                aria-label="Voltar para a lista"
                onClick={() => setHistoricoDetalhe(null)}
                style={{ ...historicoBackPill, flexShrink: 0 }}
              >
                <span style={{ fontSize: 26, lineHeight: 1, fontWeight: 400 }} aria-hidden>
                  ‹
                </span>
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  setHistoricoDetalhe(null);
                  setStep("identificacao");
                }}
                style={{
                  flexShrink: 0,
                  minHeight: 44,
                  padding: "0 12px",
                  border: "none",
                  background: "transparent",
                  color: "var(--accent)",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Início
              </button>
            </div>
            {atuaComoSupervisor && (
              <div style={{ marginBottom: 12 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 8,
                    background:
                      historicoDetalhe.tipo_avaliador === "supervisor"
                        ? "#e0f2fe"
                        : "var(--accent-soft)",
                    color:
                      historicoDetalhe.tipo_avaliador === "supervisor"
                        ? "#0369a1"
                        : "var(--accent)",
                  }}
                >
                  {historicoDetalhe.tipo_avaliador === "supervisor"
                    ? "Supervisão"
                    : "Gerente"}
                </span>
              </div>
            )}
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
                  <h3
                    style={{ margin: "0 0 4px", fontSize: 18, color: "var(--text-primary)" }}
                  >
                    {historicoDetalhe.unidade}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                    {historicoDetalhe.avaliador_nome} ·{" "}
                    {formatDate(historicoDetalhe.checkout_em || historicoDetalhe.criado_em)} ·{" "}
                    {textoTurnoLista(historicoDetalhe.turno)}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: getScoreColor(pctGlob),
                    }}
                  >
                    {pctGlob}%
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {historicoDetalhe.nota_total != null &&
                    historicoDetalhe.nota_maxima != null
                      ? `${historicoDetalhe.nota_total}/${historicoDetalhe.nota_maxima} pts`
                      : "—"}
                  </div>
                </div>
              </div>
            </div>

            {podeGestionarHistoricoLista && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => {
                    setHistOpError(null);
                    setHistEditModal(historicoDetalhe);
                    setHistEditDraft(historicoDetalhe.unidade ?? "");
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--card-bg)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "var(--text-primary)",
                  }}
                >
                  Editar loja
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHistOpError(null);
                    setHistDelModal(historicoDetalhe);
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #fecaca",
                    background: "#fef2f2",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "#b91c1c",
                  }}
                >
                  Eliminar avaliação
                </button>
              </div>
            )}

            <ResultadoPorSecaoExpandivel
              linhasPorSecao={porSecaoHistorico}
              respostas={historicoDetalhe.respostas}
              avaliacaoKey={historicoDetalhe.id}
            />
          </>
        )}

        {histDelModal && (
          <div
            role="presentation"
            onClick={() => !histOpLoading && setHistDelModal(null)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              background: "rgba(15, 23, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="hist-del-title"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 380,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 20,
                boxShadow: "0 12px 40px rgba(15,23,42,0.14)",
              }}
            >
              <h3
                id="hist-del-title"
                style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text-primary)" }}
              >
                Eliminar esta avaliação?
              </h3>
              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  lineHeight: 1.45,
                }}
              >
                Esta acção não pode ser desfeita.
              </p>
              {histOpError && (
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#b91c1c" }}>{histOpError}</p>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  disabled={histOpLoading}
                  onClick={() => !histOpLoading && setHistDelModal(null)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: histOpLoading ? "not-allowed" : "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={histOpLoading}
                  onClick={historicoOpEliminarConfirm}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: "#b91c1c",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: histOpLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {histOpLoading ? "A eliminar…" : "Eliminar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {histEditModal && (
          <div
            role="presentation"
            onClick={() => !histOpLoading && setHistEditModal(null)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              background: "rgba(15, 23, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="hist-edit-title"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 400,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 20,
                boxShadow: "0 12px 40px rgba(15,23,42,0.14)",
              }}
            >
              <h3
                id="hist-edit-title"
                style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text-primary)" }}
              >
                Alterar loja
              </h3>
              <p
                style={{
                  margin: "0 0 14px",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  lineHeight: 1.45,
                }}
              >
                Só o nome da loja é alterado; as respostas mantêm-se.
              </p>
              {histUnidLoading ? (
                <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--text-secondary)" }}>
                  A carregar lojas…
                </p>
              ) : (
                <label style={{ display: "block", marginBottom: 16 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: 6,
                    }}
                  >
                    Loja
                  </span>
                  <select
                    value={histEditDraft}
                    onChange={(e) => setHistEditDraft(e.target.value)}
                    style={{
                      width: "100%",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      padding: "12px 14px",
                      fontSize: 15,
                      background: "var(--card-bg)",
                      color: "var(--text-primary)",
                      boxSizing: "border-box",
                    }}
                  >
                    {histUnidList.map((u) => (
                      <option key={u.codigo ?? u.nome} value={u.nome}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {histOpError && (
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#b91c1c" }}>{histOpError}</p>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  disabled={histOpLoading}
                  onClick={() => !histOpLoading && setHistEditModal(null)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: histOpLoading ? "not-allowed" : "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={histOpLoading || histUnidLoading || !histEditDraft.trim()}
                  onClick={historicoOpSalvarUnidade}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: "var(--accent)",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor:
                      histOpLoading || histUnidLoading || !histEditDraft.trim()
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {histOpLoading ? "A guardar…" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === "identificacao") {
    const podeIniciar =
      Boolean(avaliador.trim() && unidadeNome.trim()) && !unidadesLoading && listaUnidades.length > 0;

    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        {toastAviso && (
          <div
            role="status"
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 10,
              fontSize: 13,
              color: "#0f172a",
              background: "#e0f2fe",
              border: "1px solid #93c5fd",
            }}
          >
            {toastAviso}
          </div>
        )}
        {userPerfil === "admin" && (
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
              Tipo de checklist
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { val: "supervisor", label: "Supervisão" },
                { val: "gerente", label: "Gerente" },
              ].map(({ val, label }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAdminModoChecklist(val)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: 10,
                    border: "1.5px solid",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    borderColor: adminModoChecklist === val ? "var(--accent)" : "var(--border)",
                    background: adminModoChecklist === val ? "var(--accent)" : "transparent",
                    color: adminModoChecklist === val ? "#fff" : "var(--text-secondary)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: "var(--accent)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 24 }}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12l2 2 4-4"/></svg>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Avaliação de Loja</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--text-secondary)" }}>
            {TEXTO_SUBTURNO[turnoEscolhido]} — {atuaComoSupervisor ? "Supervisão" : "Gerente"}
          </p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!avaliador.trim() || !unidadeNome.trim()) return;
            setSyncError(null);
            setToastAviso("");
            setIniciarLoading(true);
            try {
              const qs = new URLSearchParams({
                nome: avaliador.trim(),
                unidade: unidadeNome.trim(),
                tipo_avaliador: atuaComoSupervisor ? "supervisor" : "gerente",
                turno: turnoEscolhido,
              });
              const chkRes = await fetch(`/api/checklist/avaliacoes/em-andamento?${qs}`, { cache: "no-store" });
              const chkJson = await chkRes.json().catch(() => ({}));
              if (!chkRes.ok) throw new Error(chkJson.error || "Falha ao verificar avaliações em curso.");

              if (chkJson.avaliacao?.id) {
                setModalContinuar({ open: true, avaliacao: chkJson.avaliacao });
                setIniciarLoading(false);
                return;
              }

              await iniciarNovaAvaliacao();
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

        {podeVerHistoricoAvaliacoes && (
          <button
            type="button"
            onClick={() => {
              setHistoricoDetalhe(null);
              setHistoricoFiltroUnidade("");
              setStep("historico");
            }}
            style={{
              width: "100%",
              marginTop: 12,
              padding: "12px",
              borderRadius: 10,
              border: "1.5px solid var(--accent)",
              background: "transparent",
              color: "var(--accent)",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Minhas avaliações
          </button>
        )}

        {modalContinuar.open && modalContinuar.avaliacao && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              background: "rgba(15,23,42,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              style={{
                maxWidth: 400,
                width: "100%",
                borderRadius: 14,
                padding: 20,
                background: "var(--card-bg, #fff)",
                border: "1px solid var(--border, #e2e8f0)",
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
                Avaliação em andamento
              </p>
              <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--text-secondary, #64748b)", lineHeight: 1.45 }}>
                Já existe um rascunho para este avaliador e unidade.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  type="button"
                  disabled={iniciarLoading}
                  onClick={async () => {
                    const av = modalContinuar.avaliacao;
                    setModalContinuar({ open: false, avaliacao: null });
                    setToastAviso("");
                    setIniciarLoading(true);
                    setSyncError(null);
                    try {
                      const turnoBusca = "tarde";
                      const rawSecoes = await fetchSecoes(turnoBusca);
                      const norm = normalizarSecoesDaApi(rawSecoes);
                      if (!norm.length) {
                        throw new Error("Não há secções ativas para este turno.");
                      }
                      setSecoesLista(norm);
                      setRespostas(respostasPersistidasParaEstado(av.respostas));
                      setAvaliacaoId(av.id);
                      setNotaConclusaoBd(null);
                      setSecaoAtual(0);
                      setStep("secao");
                    } catch (err) {
                      console.error(err);
                      setSyncError(err.message ?? "Não foi possível retomar a avaliação.");
                    } finally {
                      setIniciarLoading(false);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "none",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: iniciarLoading ? "not-allowed" : "pointer",
                    background: "var(--accent, #0ea5e9)",
                    color: "#fff",
                  }}
                >
                  Continuar avaliação de{" "}
                  {formatDateTimePt(modalContinuar.avaliacao.checkin_em || modalContinuar.avaliacao.criado_em)}
                </button>
                <button
                  type="button"
                  disabled={iniciarLoading}
                  onClick={async () => {
                    const avId = modalContinuar.avaliacao.id;
                    setModalContinuar({ open: false, avaliacao: null });
                    setToastAviso("A avaliação em curso será eliminada.");
                    setSyncError(null);
                    setIniciarLoading(true);
                    try {
                      await eliminarAvaliacaoApi(avId);
                      await iniciarNovaAvaliacao();
                    } catch (err) {
                      console.error(err);
                      setSyncError(err.message ?? "Não foi possível substituir a avaliação.");
                    } finally {
                      setIniciarLoading(false);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1.5px solid var(--border, #e2e8f0)",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: iniciarLoading ? "not-allowed" : "pointer",
                    background: "transparent",
                    color: "var(--text-primary, #0f172a)",
                  }}
                >
                  Nova avaliação{" "}
                  <span style={{ fontWeight: 500, opacity: 0.85 }}>
                    (elimina a anterior)
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === "concluido") {
    const pct =
      notaConclusaoBd?.percentual != null && Number.isFinite(Number(notaConclusaoBd.percentual))
        ? Math.round(Number(notaConclusaoBd.percentual))
        : null;
    const cor = pct != null ? getScoreColor(pct) : "var(--text-secondary)";
    const scoreBg = pct != null ? getScoreBg(pct) : "var(--border)";
    const ptsLinha =
      notaConclusaoBd?.nota_total != null &&
      notaConclusaoBd?.nota_maxima != null &&
      Number.isFinite(Number(notaConclusaoBd.nota_total)) &&
      Number.isFinite(Number(notaConclusaoBd.nota_maxima))
        ? `${notaConclusaoBd.nota_total}/${notaConclusaoBd.nota_maxima} pts`
        : "—";
    const textoPontosGlobal =
      notaConclusaoBd?.nota_total != null &&
      notaConclusaoBd?.nota_maxima != null &&
      Number.isFinite(Number(notaConclusaoBd.nota_total)) &&
      Number.isFinite(Number(notaConclusaoBd.nota_maxima))
        ? `${notaConclusaoBd.nota_total} de ${notaConclusaoBd.nota_maxima} pontos`
        : "Pontuação indisponível (recarregue ou consulte o histórico).";
    const secoesMontarConclusao = (secoesLista ?? []).map((s) => ({
      id: s.id,
      titulo: s.titulo,
      pontos_max: Number(s.pontos_max) || 0,
    }));
    const porSecaoConclusao = montarPorSecao(
      secoesMontarConclusao,
      respostasFormParaMontarPorSecao(secoesLista, respostas)
    );
    const respostasDetalheConclusao = respostasFormParaDetalheExibicao(
      secoesLista,
      respostas
    );

    if (conclusaoVerRespostasDetalhe) {
      return (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
          <button
            type="button"
            onClick={() => setConclusaoVerRespostasDetalhe(false)}
            style={{
              marginBottom: 16,
              padding: "8px 4px",
              border: "none",
              background: "none",
              color: "var(--accent)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              display: "block",
              textAlign: "left",
            }}
          >
            ← Voltar
          </button>
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
                  {unidadeNome}
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                  {avaliador} · {textoTurnoLista(turnoEscolhido)}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: pct != null ? getScoreColor(pct) : "var(--text-secondary)",
                  }}
                >
                  {pct != null ? `${pct}%` : "—"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ptsLinha}</div>
              </div>
            </div>
          </div>

          <ResultadoPorSecaoExpandivel
            linhasPorSecao={porSecaoConclusao}
            respostas={respostasDetalheConclusao}
            avaliacaoKey={avaliacaoId ?? "conclusao"}
          />

          {podeVerHistoricoAvaliacoes && (
            <button
              type="button"
              onClick={() => {
                setConclusaoVerRespostasDetalhe(false);
                setHistoricoDetalhe(null);
                setHistoricoFiltroUnidade("");
                setStep("historico");
              }}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 10,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Ver todas as avaliações
            </button>
          )}
        </div>
      );
    }

    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 16px", textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: scoreBg, border: `3px solid ${cor}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 32, fontWeight: 800, color: cor }}>
          {pct != null ? `${pct}%` : "—"}
        </div>
        <h2 style={{ margin: "0 0 8px", color: "var(--text-primary)" }}>Avaliação concluída!</h2>
        <p style={{ color: "var(--text-secondary)", margin: "0 0 24px" }}>{textoPontosGlobal}</p>

        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 24, textAlign: "left" }}>
          {porSecaoConclusao.map((row) => {
            const maxS = row.pontos_max_secao ?? 0;
            const pts = row.pontos_obtidos_secao ?? 0;
            const pctS = row.percentual ?? 0;
            return (
              <div key={row.secao_id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{row.titulo}</span>
                  <span style={{ fontSize: 13, color: getScoreColor(pctS), fontWeight: 700 }}>{pts}/{maxS}</span>
                </div>
                <ProgressBar value={pts} max={maxS || 1} color={getScoreColor(pctS)} />
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setConclusaoVerRespostasDetalhe(true)}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 10,
            border: "1.5px solid var(--border)",
            background: "var(--card-bg)",
            color: "var(--text-primary)",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          Ver perguntas e respostas
        </button>

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
          setConclusaoVerRespostasDetalhe(false);
          setNotaConclusaoBd(null);
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
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 2 }}>
              Seção {secaoAtual + 1} de {secoesLista.length}
            </span>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{secao.titulo}</h2>
          </div>
          <div style={{ marginLeft: 12, textAlign: "right" }}>
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
          <PerguntaCard
            key={p.id}
            pergunta={p}
            resposta={respostas[p.id]}
            avaliacaoId={avaliacaoId}
            onChange={(val) => handleResposta(p.id, val)}
          />
        ))}
      </div>

      {/* Footer com navegação */}
      <div style={{ position: "sticky", bottom: 0, background: "var(--bg)", borderTop: "1px solid var(--border)", padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "stretch" }}>
        {secaoAtual > 0 && (
          <button type="button" onClick={() => setSecaoAtual(s => s - 1)}
            style={{ flex: "1 1 100px", minWidth: 90, padding: "12px", borderRadius: 10, border: "1.5px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Anterior
          </button>
        )}
        <button
          type="button"
          onClick={() => setModalSairOpen(true)}
          style={{
            flex: "0 0 auto",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1.5px solid #dc2626",
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Sair
        </button>
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
                setNotaConclusaoBd({
                  nota_total: jsonFim.nota_total,
                  nota_maxima: jsonFim.nota_maxima,
                  percentual: jsonFim.percentual,
                });
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
          style={{ flex: "2 1 140px", minWidth: 120, padding: "12px", borderRadius: 10, border: "none", background: podeProsseguir && !navegarLoading ? "var(--accent)" : "var(--border)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: podeProsseguir && !navegarLoading ? "pointer" : "not-allowed" }}>
          {navegarLoading
            ? "A guardar…"
            : secaoAtual < secoesLista.length - 1
              ? "Próxima seção →"
              : "Concluir avaliação"}
        </button>
      </div>

      {modalSairOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              maxWidth: 400,
              width: "100%",
              borderRadius: 14,
              padding: 20,
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
            }}
          >
            <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
              Sair da avaliação
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.45 }}>
              se optar por salvar e sair, essa avaliação poderá ser continuada depois.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                onClick={() => voltarAoInicioChecklist()}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "none",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "var(--accent)",
                  color: "#fff",
                }}
              >
                Salvar e sair
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!avaliacaoId) {
                    voltarAoInicioChecklist();
                    return;
                  }
                  setSyncError(null);
                  try {
                    await eliminarAvaliacaoApi(avaliacaoId);
                  } catch (err) {
                    console.error(err);
                    setSyncError(err.message ?? "Não foi possível eliminar a avaliação.");
                    return;
                  }
                  voltarAoInicioChecklist();
                }}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #fecaca",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "#fef2f2",
                  color: "#991b1b",
                }}
              >
                Descartar e sair
              </button>
              <button
                type="button"
                onClick={() => setModalSairOpen(false)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "transparent",
                  color: "var(--text-secondary)",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
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

function secoesComRespostasParaMontar(secoesLista, respostas, fallbackTurno = null) {
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

function montarPorSecao(secoes, respostas) {
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

// ─── VIEW: DASHBOARD ─────────────────────────────────────────────────────────
function DashboardView({ userPerfil = "gerente" }) {
  const [perguntasModalOpen, setPerguntasModalOpen] = useState(false);
  const [tipoDashboard, setTipoDashboard] = useState(
    userPerfil === "supervisor" ? "supervisor" : "gerente"
  );
  const [filtro, setFiltro] = useState("todas");
  const [detalhe, setDetalhe] = useState(null);
  const [secoes, setSecoes] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [avaliacoesAnterioresAberto, setAvaliacoesAnterioresAberto] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [modalEditarUnidade, setModalEditarUnidade] = useState(null);
  const [editUnidadeDraft, setEditUnidadeDraft] = useState("");
  const [modalEliminarAval, setModalEliminarAval] = useState(null);
  const [unidadesEdicao, setUnidadesEdicao] = useState([]);
  const [unidadesEdicaoLoading, setUnidadesEdicaoLoading] = useState(false);
  const [dashboardAcaoLoading, setDashboardAcaoLoading] = useState(false);
  const [dashboardAcaoErro, setDashboardAcaoErro] = useState(null);

  const podeGestionarAvaliacoes = userPerfil === "admin" || userPerfil === "supervisor";

  useEffect(() => {
    setAvaliacoesAnterioresAberto(false);
    setDetalhe(null);
  }, [tipoDashboard]);

  useEffect(() => {
    if (!modalEditarUnidade) return;
    let cancel = false;
    (async () => {
      setUnidadesEdicaoLoading(true);
      try {
        const res = await fetch("/api/checklist/unidades?perfil=supervisor");
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Falha ao carregar lojas.");
        if (!cancel) setUnidadesEdicao(json.unidades ?? []);
      } catch {
        if (!cancel) setUnidadesEdicao([]);
      } finally {
        if (!cancel) setUnidadesEdicaoLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [modalEditarUnidade?.id]);

  useEffect(() => {
    if (modalEditarUnidade) setEditUnidadeDraft(modalEditarUnidade.unidade ?? "");
  }, [modalEditarUnidade?.id]);

  useEffect(() => {
    setAvaliacoesAnterioresAberto(false);
  }, [filtro]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ tipo_avaliador: tipoDashboard });
        const res = await fetch(`/api/checklist/avaliacoes?${qs}`, { cache: "no-store" });
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
  }, [tipoDashboard, dashboardRefreshKey]);

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
  const porSecaoDisplay = displayAv
    ? montarPorSecao(
        secoesComRespostasParaMontar(
          secoes,
          displayAv.respostas,
          turnoModeloPorTipoAvaliador(displayAv.tipo_avaliador)
        ),
        displayAv.respostas
      )
    : [];

  let deltaVsAnterior = null;
  if (filtro !== "todas" && avaliacoesFiltradas.length >= 2) {
    const [atual, anterior] = avaliacoesFiltradas;
    deltaVsAnterior = Number(atual.percentual || 0) - Number(anterior.percentual || 0);
  }

  const numUnidadesKpi =
    filtro === "todas" ? unidades.length : avaliacoesFiltradas.length > 0 ? 1 : 0;

  const recentAv = avaliacoesFiltradas[0] ?? null;
  const olderAvs = avaliacoesFiltradas.slice(1);

  function refreshDashboard() {
    setDashboardRefreshKey((k) => k + 1);
  }

  async function executarEliminarDashboard() {
    if (!modalEliminarAval) return;
    const id = modalEliminarAval.id;
    setDashboardAcaoErro(null);
    setDashboardAcaoLoading(true);
    try {
      await eliminarAvaliacaoApi(id);
      setModalEliminarAval(null);
      if (detalhe?.id === id) setDetalhe(null);
      refreshDashboard();
    } catch (e) {
      setDashboardAcaoErro(e.message ?? "Erro ao eliminar.");
    } finally {
      setDashboardAcaoLoading(false);
    }
  }

  async function executarSalvarUnidadeDashboard() {
    if (!modalEditarUnidade || !editUnidadeDraft.trim()) return;
    setDashboardAcaoErro(null);
    setDashboardAcaoLoading(true);
    try {
      await atualizarUnidadeAvaliacaoApi(modalEditarUnidade.id, editUnidadeDraft.trim());
      setModalEditarUnidade(null);
      refreshDashboard();
    } catch (e) {
      setDashboardAcaoErro(e.message ?? "Erro ao guardar.");
    } finally {
      setDashboardAcaoLoading(false);
    }
  }

  function linhaAvaliacaoDashboard(av, { isRecent }) {
    const ativo = displayAv?.id === av.id;
    return (
      <div
        key={av.id}
        style={{
          display: "flex",
          gap: 8,
          alignItems: "stretch",
          width: "100%",
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (isRecent) setDetalhe(null);
            else setDetalhe(av);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            background: ativo ? "var(--accent-soft)" : "var(--card-bg)",
            border: `1.5px solid ${ativo ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 14,
            padding: "16px",
            cursor: "pointer",
            textAlign: "left",
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
        {podeGestionarAvaliacoes ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 6,
              flexShrink: 0,
              padding: "4px 0",
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDashboardAcaoErro(null);
                setModalEditarUnidade(av);
                setEditUnidadeDraft(av.unidade ?? "");
              }}
              style={{
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--card-bg)",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDashboardAcaoErro(null);
                setModalEliminarAval(av);
              }}
              style={{
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#b91c1c",
                cursor: "pointer",
              }}
            >
              Eliminar
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}>
      {userPerfil === "admin" || userPerfil === "supervisor" ? (
        <button
          type="button"
          onClick={() => setPerguntasModalOpen(true)}
          style={{
            width: "100%",
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1.5px solid var(--accent)",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Ver perguntas
        </button>
      ) : null}
      <AdminPerguntasModal
        open={perguntasModalOpen}
        onClose={() => setPerguntasModalOpen(false)}
        userPerfil={userPerfil}
      />
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
                  setAvaliacoesAnterioresAberto(false);
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
            {dashboardAcaoErro && (
              <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{dashboardAcaoErro}</p>
            )}
            {olderAvs.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setAvaliacoesAnterioresAberto((o) => !o)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card-bg)",
                    color: "var(--text-primary)",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>Avaliações anteriores ({olderAvs.length})</span>
                  <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>
                    {avaliacoesAnterioresAberto ? "▲" : "▼"}
                  </span>
                </button>
                {avaliacoesAnterioresAberto && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      marginTop: 10,
                      paddingLeft: 4,
                      borderLeft: "2px solid var(--border)",
                    }}
                  >
                    {olderAvs.map((av) => linhaAvaliacaoDashboard(av, { isRecent: false }))}
                  </div>
                )}
              </div>
            )}
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
                  Detalhe {detalhe ? " (seleccionada)" : " (última na lista)"}
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

              {podeGestionarAvaliacoes && (
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDashboardAcaoErro(null);
                      setModalEditarUnidade(displayAv);
                      setEditUnidadeDraft(displayAv.unidade ?? "");
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--card-bg)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      color: "var(--text-primary)",
                    }}
                  >
                    Editar loja
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDashboardAcaoErro(null);
                      setModalEliminarAval(displayAv);
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #fecaca",
                      background: "#fef2f2",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      color: "#b91c1c",
                    }}
                  >
                    Eliminar avaliação
                  </button>
                </div>
              )}

              <ResultadoPorSecaoExpandivel
                linhasPorSecao={porSecaoDisplay}
                respostas={displayAv.respostas}
                avaliacaoKey={displayAv.id}
              />
            </div>
          )}

          {modalEliminarAval && (
            <div
              role="presentation"
              onClick={() => !dashboardAcaoLoading && setModalEliminarAval(null)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 100,
                background: "rgba(15, 23, 42, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="dash-del-title"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  maxWidth: 380,
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 20,
                  boxShadow: "0 12px 40px rgba(15,23,42,0.14)",
                }}
              >
                <h3
                  id="dash-del-title"
                  style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text-primary)" }}
                >
                  Eliminar esta avaliação?
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.45 }}>
                  Esta acção não pode ser desfeita. As respostas desta avaliação deixam de contar nas estatísticas.
                </p>
                {dashboardAcaoErro && (
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#b91c1c" }}>{dashboardAcaoErro}</p>
                )}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    disabled={dashboardAcaoLoading}
                    onClick={() => {
                      if (!dashboardAcaoLoading) setModalEliminarAval(null);
                    }}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "transparent",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: dashboardAcaoLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={dashboardAcaoLoading}
                    onClick={executarEliminarDashboard}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "none",
                      background: "#b91c1c",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: dashboardAcaoLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {dashboardAcaoLoading ? "A eliminar…" : "Eliminar"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {modalEditarUnidade && (
            <div
              role="presentation"
              onClick={() => !dashboardAcaoLoading && setModalEditarUnidade(null)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 100,
                background: "rgba(15, 23, 42, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="dash-edit-title"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  maxWidth: 400,
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 20,
                  boxShadow: "0 12px 40px rgba(15,23,42,0.14)",
                }}
              >
                <h3
                  id="dash-edit-title"
                  style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text-primary)" }}
                >
                  Alterar loja
                </h3>
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.45 }}>
                  Só o nome da loja é alterado; as respostas e pontuações mantêm-se.
                </p>
                {unidadesEdicaoLoading ? (
                  <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--text-secondary)" }}>
                    A carregar lojas…
                  </p>
                ) : (
                  <label style={{ display: "block", marginBottom: 16 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: 6,
                      }}
                    >
                      Loja
                    </span>
                    <select
                      value={editUnidadeDraft}
                      onChange={(e) => setEditUnidadeDraft(e.target.value)}
                      style={{
                        width: "100%",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        padding: "12px 14px",
                        fontSize: 15,
                        background: "var(--card-bg)",
                        color: "var(--text-primary)",
                        boxSizing: "border-box",
                      }}
                    >
                      {unidadesEdicao.map((u) => (
                        <option key={u.codigo ?? u.nome} value={u.nome}>
                          {u.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {dashboardAcaoErro && (
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#b91c1c" }}>{dashboardAcaoErro}</p>
                )}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    disabled={dashboardAcaoLoading}
                    onClick={() => {
                      if (!dashboardAcaoLoading) setModalEditarUnidade(null);
                    }}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "transparent",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: dashboardAcaoLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={dashboardAcaoLoading || unidadesEdicaoLoading || !editUnidadeDraft.trim()}
                    onClick={executarSalvarUnidadeDashboard}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "none",
                      background: "var(--accent)",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor:
                        dashboardAcaoLoading || unidadesEdicaoLoading || !editUnidadeDraft.trim()
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {dashboardAcaoLoading ? "A guardar…" : "Guardar"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── APP PRINCIPAL ───────────────────────────────────────────────────────────
export default function ChecklistApp({ userPerfil = "supervisor", uid }) {
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
        <ChecklistView userPerfil={userPerfil} uid={uid} />
      ) : (
        <DashboardView userPerfil={userPerfil} />
      )}
    </div>
  );
}
