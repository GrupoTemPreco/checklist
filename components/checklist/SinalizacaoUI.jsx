"use client";

import { useState } from "react";

/** Indexa pendências da API por pergunta_id + tipo_campo. */
export function indexarPendencias(lista) {
  const map = {};
  for (const row of lista ?? []) {
    const pid = row?.pergunta_id != null ? String(row.pergunta_id) : "";
    if (!pid) continue;
    if (!map[pid]) map[pid] = { comentario: null, plano_acao: null };
    if (row.tipo_campo === "comentario") map[pid].comentario = row;
    if (row.tipo_campo === "plano_acao") map[pid].plano_acao = row;
  }
  return map;
}

export async function fetchPendenciasLoja(loja) {
  const nome = String(loja ?? "").trim();
  if (!nome) return [];
  const qs = new URLSearchParams({ loja: nome });
  const res = await fetch(`/api/checklist/sinalizacoes?${qs}`, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Falha ao carregar pendências.");
  return json.pendencias ?? [];
}

function formatDataMotivo(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

/** Balão "Isso foi resolvido?" para uma pendência ativa. */
export function BalaoPendenciaVerificacao({
  pendencia,
  labelCampo,
  verificacao,
  motivo,
  onVerificacao,
  onMotivo,
}) {
  if (!pendencia) return null;
  const vezes = Number(pendencia.vezes_nao_resolvido) || 0;

  return (
    <div
      style={{
        marginTop: 10,
        padding: 12,
        borderRadius: 10,
        background: "#fffbeb",
        border: "1.5px solid #f59e0b",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
        <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden>
          ⚠
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 700,
              color: "#92400e",
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            Pendência — {labelCampo}
          </p>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13,
              color: "#78350f",
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
            }}
          >
            {pendencia.texto_original || "—"}
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#92400e", fontWeight: 600 }}>
            Número de vezes que pendência foi ignorada: {vezes}
          </p>
        </div>
      </div>

      <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#78350f" }}>
        Isso foi resolvido?
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        {["sim", "nao"].map((val) => {
          const ativo = verificacao === val;
          return (
            <button
              key={val}
              type="button"
              onClick={() => onVerificacao(val)}
              style={{
                flex: 1,
                padding: "10px 8px",
                borderRadius: 8,
                border: "1.5px solid",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                borderColor: ativo ? "#d97706" : "#fcd34d",
                background: ativo ? "#d97706" : "#fff",
                color: ativo ? "#fff" : "#92400e",
              }}
            >
              {val === "sim" ? "Sim" : "Não"}
            </button>
          );
        })}
      </div>

      {verificacao === "nao" && (
        <div style={{ marginTop: 10 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "#92400e",
              marginBottom: 6,
            }}
          >
            Motivo (obrigatório)
          </label>
          <textarea
            rows={2}
            value={motivo || ""}
            onChange={(e) => onMotivo(e.target.value)}
            placeholder="Explique por que ainda não foi resolvido…"
            style={{
              width: "100%",
              borderRadius: 8,
              border: "1.5px solid #f59e0b",
              padding: "8px 10px",
              fontSize: 13,
              resize: "vertical",
              background: "#fff",
              color: "#78350f",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}
    </div>
  );
}

export function CheckboxSinalizar({ checked, onChange, label }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        marginTop: 8,
        cursor: "pointer",
        fontSize: 12,
        color: "var(--text-secondary)",
        lineHeight: 1.4,
      }}
    >
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, accentColor: "#0ea5e9", flexShrink: 0 }}
      />
      <span>{label}</span>
    </label>
  );
}

export function BotaoVerHistoricoPendencia({ pendencia, labelCampo }) {
  const [open, setOpen] = useState(false);
  if (!pendencia) return null;

  const historico = Array.isArray(pendencia.historico_motivos_nao)
    ? [...pendencia.historico_motivos_nao].sort((a, b) => {
        const ta = new Date(a?.data || 0).getTime();
        const tb = new Date(b?.data || 0).getTime();
        return tb - ta;
      })
    : [];
  const vezes = Number(pendencia.vezes_nao_resolvido) || 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          marginTop: 6,
          padding: "4px 10px",
          borderRadius: 8,
          border: "1px solid #fcd34d",
          background: "#fffbeb",
          color: "#92400e",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Ver histórico da pendência
        {labelCampo ? ` (${labelCampo})` : ""}
      </button>

      {open && (
        <div
          role="presentation"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 220,
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
            aria-labelledby="hist-pend-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              maxHeight: "85vh",
              overflow: "auto",
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              padding: 20,
              boxShadow: "0 12px 40px rgba(15,23,42,0.14)",
            }}
          >
            <h3
              id="hist-pend-title"
              style={{ margin: "0 0 12px", fontSize: 16, color: "#0f172a" }}
            >
              Histórico da pendência
              {labelCampo ? ` — ${labelCampo}` : ""}
            </h3>

            <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 600, color: "#64748b" }}>
              Texto original sinalizado
            </p>
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 14,
                color: "#0f172a",
                whiteSpace: "pre-wrap",
                lineHeight: 1.45,
              }}
            >
              {pendencia.texto_original || "—"}
            </p>

            <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600, color: "#92400e" }}>
              Número de vezes que pendência foi ignorada: {vezes}
            </p>

            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
              Motivos registrados
            </p>
            {historico.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
                Ainda não houve nenhuma verificação dessa pendência.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {historico.map((item, i) => (
                  <li
                    key={`${item?.data}-${i}`}
                    style={{ marginBottom: 10, fontSize: 13, color: "#334155", lineHeight: 1.4 }}
                  >
                    <span style={{ fontWeight: 600, color: "#64748b", fontSize: 12 }}>
                      {formatDataMotivo(item?.data)}
                    </span>
                    <br />
                    {item?.motivo != null && String(item.motivo).trim() !== ""
                      ? String(item.motivo)
                      : "(sem motivo informado)"}
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                marginTop: 16,
                width: "100%",
                padding: 12,
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                color: "#0f172a",
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Valida pendências ativas antes de concluir.
 * @returns {string[]} mensagens de erro (vazias = ok)
 */
export function validarPendenciasAntesConcluir({
  secoesLista,
  idPerguntaParaGravar,
  pendenciasMap,
  metaSinalizacao,
}) {
  const erros = [];
  for (const sec of secoesLista ?? []) {
    for (const p of sec.perguntas ?? []) {
      const dbId = idPerguntaParaGravar(p) || String(p.id);
      const pend = pendenciasMap?.[dbId];
      if (!pend) continue;
      const meta = metaSinalizacao?.[p.id] || {};
      const codigo = p.codigo || dbId;

      if (pend.comentario) {
        if (meta.verificacao_comentario !== "sim" && meta.verificacao_comentario !== "nao") {
          erros.push(`${codigo}: responda se o comentário pendente foi resolvido`);
        } else if (
          meta.verificacao_comentario === "nao" &&
          !String(meta.motivo_comentario ?? "").trim()
        ) {
          erros.push(`${codigo}: informe o motivo do comentário não resolvido`);
        }
      }
      if (pend.plano_acao) {
        if (meta.verificacao_plano_acao !== "sim" && meta.verificacao_plano_acao !== "nao") {
          erros.push(`${codigo}: responda se o plano de ação pendente foi resolvido`);
        } else if (
          meta.verificacao_plano_acao === "nao" &&
          !String(meta.motivo_plano_acao ?? "").trim()
        ) {
          erros.push(`${codigo}: informe o motivo do plano de ação não resolvido`);
        }
      }
    }
  }
  return erros;
}

/** Monta items para POST /concluir (só perguntas com interação relevante). */
export function montarItemsSinalizacaoConcluir({
  secoesLista,
  respostas,
  idPerguntaParaGravar,
  pendenciasMap,
  metaSinalizacao,
}) {
  const items = [];
  const seen = new Set();

  for (const sec of secoesLista ?? []) {
    for (const p of sec.perguntas ?? []) {
      const uiId = p.id;
      const dbId = idPerguntaParaGravar(p) || String(p.id);
      if (seen.has(dbId)) continue;
      seen.add(dbId);

      const r = respostas?.[uiId] || {};
      const meta = metaSinalizacao?.[uiId] || {};
      const pend = pendenciasMap?.[dbId] || {};

      const sinalizar_comentario = !pend.comentario && !!meta.sinalizar_comentario;
      const sinalizar_plano_acao = !pend.plano_acao && !!meta.sinalizar_plano_acao;
      const verificacao_comentario = pend.comentario
        ? meta.verificacao_comentario === "sim" || meta.verificacao_comentario === "nao"
          ? meta.verificacao_comentario
          : null
        : null;
      const verificacao_plano_acao = pend.plano_acao
        ? meta.verificacao_plano_acao === "sim" || meta.verificacao_plano_acao === "nao"
          ? meta.verificacao_plano_acao
          : null
        : null;

      const temInteracao =
        sinalizar_comentario ||
        sinalizar_plano_acao ||
        verificacao_comentario != null ||
        verificacao_plano_acao != null;

      if (!temInteracao) continue;

      items.push({
        pergunta_id: dbId,
        comentario: r.comentario ? String(r.comentario) : null,
        plano_acao: r.plano_acao ? String(r.plano_acao) : null,
        sinalizar_comentario,
        sinalizar_plano_acao,
        verificacao_comentario,
        motivo_comentario:
          verificacao_comentario === "nao"
            ? String(meta.motivo_comentario ?? "").trim()
            : null,
        verificacao_plano_acao,
        motivo_plano_acao:
          verificacao_plano_acao === "nao"
            ? String(meta.motivo_plano_acao ?? "").trim()
            : null,
      });
    }
  }
  return items;
}
