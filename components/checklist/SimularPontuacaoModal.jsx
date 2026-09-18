"use client";

import { useEffect, useMemo, useState } from "react";

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmtPct(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
}

function fmtPts(obt, max) {
  if (obt == null && max == null) return "—";
  return `${num(obt)}/${num(max)} pts`;
}

/** Normaliza linhas do resumo RPC (aceita nomes alternativos). */
function normalizarResumo(rows) {
  return (rows ?? []).map((r) => ({
    nivel: String(r.nivel ?? "").toLowerCase(),
    secao_id: r.secao_id != null ? String(r.secao_id) : null,
    titulo:
      r.titulo ??
      r.secao_titulo ??
      r.nome_secao ??
      (r.nivel === "total" ? "Total" : "Seção"),
    pontos: num(r.pontos ?? r.pontos_obtidos ?? r.pontos_simulados),
    pontos_max: num(r.pontos_max ?? r.pontos_maxima ?? r.maximo ?? r.max),
    percentual: num(r.percentual),
    qtd_sem_correspondencia: num(
      r.qtd_sem_correspondencia ?? r.sem_correspondencia ?? 0
    ),
  }));
}

function normalizarDetalhe(rows) {
  return (rows ?? []).map((r) => ({
    situacao: String(r.situacao ?? r.status ?? "desconhecido"),
    codigo: r.codigo ?? r.pergunta_codigo ?? "—",
    texto: r.texto ?? r.pergunta_texto ?? r.pergunta ?? "—",
  }));
}

const LABEL_SITUACAO = {
  sem_correspondencia: "Sem correspondente na pontuação atual",
  sem_equivalente: "Sem equivalente na pontuação atual",
  ignorada: "Ignorada",
  fora: "Fora da simulação",
  pergunta_inativa: "Pergunta inativa",
  secao_inativa: "Seção inativa",
};

function labelSituacao(s) {
  const key = String(s ?? "").toLowerCase();
  return LABEL_SITUACAO[key] || s || "Outros";
}

/**
 * Modal de simulação de pontuação (admin). Somente leitura — não altera a avaliação.
 */
export default function SimularPontuacaoModal({
  open,
  onClose,
  avaliacaoId,
  perfil = "admin",
  notaOriginal = null,
  porSecaoOriginal = [],
}) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [resumo, setResumo] = useState([]);
  const [detalhe, setDetalhe] = useState([]);
  const [foraAberto, setForaAberto] = useState(false);

  useEffect(() => {
    if (!open || !avaliacaoId) return;
    let cancel = false;
    setLoading(true);
    setErro(null);
    setResumo([]);
    setDetalhe([]);
    setForaAberto(false);

    (async () => {
      try {
        const qs = new URLSearchParams({ perfil });
        const res = await fetch(
          `/api/avaliacoes/${encodeURIComponent(avaliacaoId)}/simular?${qs}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Falha ao simular pontuação.");
        if (cancel) return;
        setResumo(normalizarResumo(json.resumo));
        setDetalhe(normalizarDetalhe(json.detalhe));
      } catch (e) {
        if (!cancel) setErro(e?.message ?? "Erro ao simular.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [open, avaliacaoId, perfil]);

  const totalSim = useMemo(
    () => resumo.find((r) => r.nivel === "total") ?? null,
    [resumo]
  );

  const secoesSim = useMemo(
    () =>
      resumo.filter(
        (r) => r.nivel === "secao" || (r.nivel !== "total" && r.secao_id)
      ),
    [resumo]
  );

  const originalPorSecao = useMemo(() => {
    const map = new Map();
    for (const s of porSecaoOriginal ?? []) {
      if (s?.secao_id != null) map.set(String(s.secao_id), s);
    }
    return map;
  }, [porSecaoOriginal]);

  const foraDaSimulacao = useMemo(
    () => detalhe.filter((d) => String(d.situacao).toLowerCase() !== "ok"),
    [detalhe]
  );

  const foraPorSituacao = useMemo(() => {
    const groups = new Map();
    for (const row of foraDaSimulacao) {
      const key = row.situacao;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    return [...groups.entries()];
  }, [foraDaSimulacao]);

  const pctOriginal = notaOriginal?.percentual != null
    ? num(notaOriginal.percentual)
    : null;
  const pctSimulado = totalSim ? num(totalSim.percentual) : null;
  const deltaPct =
    pctOriginal != null && pctSimulado != null
      ? pctSimulado - pctOriginal
      : null;

  const qtdSemCorr = totalSim
    ? num(totalSim.qtd_sem_correspondencia)
    : secoesSim.reduce((a, s) => a + num(s.qtd_sem_correspondencia), 0);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={() => !loading && onClose?.()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(15, 23, 42, 0.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 0,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="simular-nota-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 540,
          maxHeight: "92vh",
          overflow: "auto",
          background: "var(--bg)",
          borderRadius: "16px 16px 0 0",
          border: "1px solid var(--border)",
          boxShadow: "0 -8px 40px rgba(15,23,42,0.18)",
          padding: "20px 16px 28px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <h3
              id="simular-nota-title"
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                color: "var(--text-primary)",
              }}
            >
              Simular nova pontuação
            </h3>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.4,
              }}
            >
              Comparação com a pontuação atual do questionário — sem gravar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={loading}
            aria-label="Fechar"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
              color: "var(--text-secondary)",
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <div
          role="status"
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            borderRadius: 10,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e3a8a",
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          Isto é uma simulação. A avaliação gravada não foi alterada.
        </div>

        {loading && (
          <p style={{ margin: "24px 0", textAlign: "center", color: "var(--text-secondary)" }}>
            A calcular simulação…
          </p>
        )}

        {erro && (
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#b91c1c" }}>{erro}</p>
        )}

        {!loading && !erro && (
          <>
            {qtdSemCorr > 0 && (
              <div
                role="alert"
                style={{
                  marginBottom: 14,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#fffbeb",
                  border: "1.5px solid #f59e0b",
                  color: "#92400e",
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
              >
                Existem <strong>{qtdSemCorr}</strong> resposta(s) sem equivalente na
                pontuação atual — ficaram fora do cálculo da simulação.
              </div>
            )}

            {/* Total */}
            <div
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 14,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  marginBottom: 10,
                }}
              >
                Total da avaliação
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    Original (gravada)
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: "var(--text-primary)",
                    }}
                  >
                    {fmtPct(pctOriginal)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {fmtPts(notaOriginal?.nota_total, notaOriginal?.nota_maxima)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    Simulada
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: "var(--accent)",
                    }}
                  >
                    {fmtPct(pctSimulado)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {totalSim
                      ? fmtPts(totalSim.pontos, totalSim.pontos_max)
                      : "—"}
                  </div>
                </div>
              </div>
              {deltaPct != null && (
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: 13,
                    fontWeight: 700,
                    color:
                      deltaPct > 0
                        ? "#16a34a"
                        : deltaPct < 0
                          ? "#dc2626"
                          : "var(--text-secondary)",
                  }}
                >
                  Diferença: {deltaPct > 0 ? "+" : ""}
                  {Number.isInteger(deltaPct) ? deltaPct : deltaPct.toFixed(1)} p.p.
                </p>
              )}
            </div>

            {/* Por seção */}
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  marginBottom: 8,
                }}
              >
                Por seção
              </div>
              {secoesSim.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                  Nenhuma linha de seção no resumo da simulação.
                </p>
              )}
              {secoesSim.map((sim) => {
                const orig = sim.secao_id
                  ? originalPorSecao.get(String(sim.secao_id))
                  : null;
                const titulo =
                  sim.titulo ||
                  orig?.titulo ||
                  (sim.secao_id ? `Seção ${sim.secao_id.slice(0, 8)}` : "Seção");
                return (
                  <div
                    key={sim.secao_id || titulo}
                    style={{
                      background: "var(--card-bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        marginBottom: 8,
                      }}
                    >
                      {titulo}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <div style={{ color: "var(--text-secondary)", marginBottom: 2 }}>
                          Original
                        </div>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                          {orig ? fmtPct(orig.percentual) : "—"}
                        </div>
                        <div style={{ color: "var(--text-secondary)" }}>
                          {orig
                            ? fmtPts(orig.pontos_obtidos_secao, orig.pontos_max_secao)
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-secondary)", marginBottom: 2 }}>
                          Simulada
                        </div>
                        <div style={{ fontWeight: 700, color: "var(--accent)" }}>
                          {fmtPct(sim.percentual)}
                        </div>
                        <div style={{ color: "var(--text-secondary)" }}>
                          {fmtPts(sim.pontos, sim.pontos_max)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Fora da simulação */}
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: 8,
              }}
            >
              <button
                type="button"
                onClick={() => setForaAberto((v) => !v)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  border: "none",
                  background: "var(--card-bg)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  Perguntas fora da simulação
                  {foraDaSimulacao.length > 0
                    ? ` (${foraDaSimulacao.length})`
                    : ""}
                </span>
                <span
                  style={{
                    fontSize: 16,
                    color: "var(--text-secondary)",
                    transform: foraAberto ? "rotate(180deg)" : "none",
                  }}
                  aria-hidden
                >
                  ▾
                </span>
              </button>
              {foraAberto && (
                <div style={{ padding: "0 14px 14px", background: "var(--card-bg)" }}>
                  {foraDaSimulacao.length === 0 ? (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: "var(--text-secondary)",
                      }}
                    >
                      Nenhuma pergunta fora da simulação (todas com situação
                      &quot;ok&quot;).
                    </p>
                  ) : (
                    foraPorSituacao.map(([sit, rows]) => (
                      <div key={sit} style={{ marginTop: 10 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#92400e",
                            marginBottom: 6,
                          }}
                        >
                          {labelSituacao(sit)} ({rows.length})
                        </div>
                        <ul
                          style={{
                            margin: 0,
                            paddingLeft: 0,
                            listStyle: "none",
                          }}
                        >
                          {rows.map((row, i) => (
                            <li
                              key={`${row.codigo}-${i}`}
                              style={{
                                fontSize: 13,
                                color: "var(--text-primary)",
                                padding: "6px 0",
                                borderTop: "1px solid var(--border)",
                                lineHeight: 1.4,
                              }}
                            >
                              <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                                {row.codigo}
                              </span>
                              {" — "}
                              {row.texto}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => onClose?.()}
          style={{
            width: "100%",
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            border: "1.5px solid var(--border)",
            background: "transparent",
            color: "var(--text-primary)",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
