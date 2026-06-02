"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  TIPOS_PERGUNTA,
  perguntaParaForm,
  formVazioNovaPergunta,
  OPCOES_PADRAO_POR_TIPO,
  pontosMaxFromOpcoes,
} from "@/lib/perguntas-admin";
import { turnoModeloPorTipoAvaliador } from "@/lib/avaliacoes-resposta-map";

const TIPO_AVALIADOR_OPTS = [
  { val: "gerente", label: "Gerente" },
  { val: "supervisor", label: "Supervisor" },
];

const TIPO_LABEL = {
  sim_nao: "Sim/Não",
  escala_3: "Escala 3",
  escala_5: "Escala 5",
  nota_livre: "Nota livre",
  texto_livre: "Texto livre",
  condicional: "Condicional",
};

const inputStyle = {
  width: "100%",
  borderRadius: 6,
  border: "1px solid var(--border)",
  padding: "8px 10px",
  fontSize: 13,
  background: "var(--card-bg)",
  color: "var(--text-primary)",
  boxSizing: "border-box",
};

const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-secondary)",
  display: "block",
  marginBottom: 4,
};

function parseOpcoes(opcoes) {
  if (opcoes == null) return [];
  if (Array.isArray(opcoes)) return opcoes;
  if (typeof opcoes === "string") {
    try {
      return JSON.parse(opcoes);
    } catch {
      return [];
    }
  }
  return [];
}

function OpcoesEditor({ opcoes, onChange, disabled }) {
  const list = parseOpcoes(opcoes);

  const update = (idx, field, value) => {
    const next = list.map((o, i) =>
      i === idx ? { ...o, [field]: field === "pontos" ? Number(value) : value } : o
    );
    onChange(next);
  };

  const add = () => {
    onChange([...list, { label: "", valor: "", pontos: 0 }]);
  };

  const remove = (idx) => {
    onChange(list.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {list.map((op, idx) => (
        <div
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 64px 28px",
            gap: 6,
            alignItems: "end",
          }}
        >
          <div>
            {idx === 0 && <span style={labelStyle}>Label</span>}
            <input
              disabled={disabled}
              value={op.label ?? ""}
              onChange={(e) => update(idx, "label", e.target.value)}
              style={inputStyle}
              placeholder="Label"
            />
          </div>
          <div>
            {idx === 0 && <span style={labelStyle}>Valor</span>}
            <input
              disabled={disabled}
              value={op.valor ?? ""}
              onChange={(e) => update(idx, "valor", e.target.value)}
              style={inputStyle}
              placeholder="valor"
            />
          </div>
          <div>
            {idx === 0 && <span style={labelStyle}>Pts</span>}
            <input
              disabled={disabled}
              type="number"
              value={op.pontos ?? 0}
              onChange={(e) => update(idx, "pontos", e.target.value)}
              style={inputStyle}
            />
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => remove(idx)}
              style={{
                border: "none",
                background: "transparent",
                color: "#b91c1c",
                fontSize: 18,
                cursor: "pointer",
                padding: "6px 0",
              }}
              aria-label="Remover opção"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={add}
          style={{
            alignSelf: "flex-start",
            fontSize: 12,
            color: "var(--accent)",
            background: "var(--accent-soft)",
            border: "none",
            borderRadius: 6,
            padding: "6px 12px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + Opção
        </button>
      )}
    </div>
  );
}

function PerguntaFormFields({
  form,
  onChange,
  secoes,
  perguntasNaSecao,
  readOnly,
}) {
  const tipoTemOpcoes = form.tipo !== "texto_livre" && form.tipo !== "nota_livre";

  const set = (field, value) => onChange({ ...form, [field]: value });

  const onTipoChange = (tipo) => {
    const opcoes = OPCOES_PADRAO_POR_TIPO[tipo]
      ? [...OPCOES_PADRAO_POR_TIPO[tipo]]
      : [];
    const pontos_max = pontosMaxFromOpcoes(opcoes);
    onChange({
      ...form,
      tipo,
      opcoes,
      pontos_max,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <span style={labelStyle}>Secção</span>
          <select
            disabled={readOnly}
            value={form.secao_id}
            onChange={(e) => set("secao_id", e.target.value)}
            style={inputStyle}
          >
            <option value="">—</option>
            {secoes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.titulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span style={labelStyle}>Ordem</span>
          <input
            disabled={readOnly}
            type="number"
            min={1}
            value={form.ordem}
            onChange={(e) => set("ordem", Number(e.target.value))}
            style={inputStyle}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 10 }}>
        <div>
          <span style={labelStyle}>Código</span>
          <input
            disabled={readOnly}
            value={form.codigo}
            onChange={(e) => set("codigo", e.target.value)}
            style={inputStyle}
            placeholder="1.2"
          />
        </div>
        <div>
          <span style={labelStyle}>Tipo</span>
          <select
            disabled={readOnly}
            value={form.tipo}
            onChange={(e) => onTipoChange(e.target.value)}
            style={inputStyle}
          >
            {TIPOS_PERGUNTA.map((t) => (
              <option key={t} value={t}>
                {TIPO_LABEL[t] ?? t}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <span style={labelStyle}>Texto da pergunta</span>
        <textarea
          disabled={readOnly}
          rows={2}
          value={form.texto}
          onChange={(e) => set("texto", e.target.value)}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div>
          <span style={labelStyle}>Pontos máx.</span>
          <input
            disabled={readOnly}
            type="number"
            min={0}
            value={form.pontos_max}
            onChange={(e) => set("pontos_max", Number(e.target.value))}
            style={inputStyle}
          />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginTop: 18 }}>
          <input
            type="checkbox"
            disabled={readOnly}
            checked={!!form.permite_foto}
            onChange={(e) => set("permite_foto", e.target.checked)}
          />
          Permite foto
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginTop: 18 }}>
          <input
            type="checkbox"
            disabled={readOnly}
            checked={form.obrigatoria !== false}
            onChange={(e) => set("obrigatoria", e.target.checked)}
          />
          Obrigatória
        </label>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
        <input
          type="checkbox"
          disabled={readOnly}
          checked={!!form.plano_acao_obrigatorio}
          onChange={(e) => set("plano_acao_obrigatorio", e.target.checked)}
        />
        Plano de ação obrigatório (flag global)
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
        <input
          type="checkbox"
          disabled={readOnly}
          checked={form.ativo !== false}
          onChange={(e) => set("ativo", e.target.checked)}
        />
        Ativa no questionário
      </label>
      {form.tipo === "condicional" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <span style={labelStyle}>Pergunta pai</span>
            <select
              disabled={readOnly}
              value={form.pergunta_pai_id}
              onChange={(e) => set("pergunta_pai_id", e.target.value)}
              style={inputStyle}
            >
              <option value="">—</option>
              {perguntasNaSecao
                .filter((p) => p.id !== form.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} — {p.texto?.slice(0, 40)}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <span style={labelStyle}>Resposta que activa</span>
            <input
              disabled={readOnly}
              value={form.resposta_pai_gatilho}
              onChange={(e) => set("resposta_pai_gatilho", e.target.value)}
              style={inputStyle}
              placeholder="nao"
            />
          </div>
        </div>
      )}
      {tipoTemOpcoes && (
        <div>
          <span style={{ ...labelStyle, marginBottom: 8 }}>Opções e pontuação</span>
          <OpcoesEditor
            opcoes={form.opcoes}
            onChange={(opcoes) =>
              onChange({
                ...form,
                opcoes,
                pontos_max: pontosMaxFromOpcoes(opcoes),
              })
            }
            disabled={readOnly}
          />
        </div>
      )}
    </div>
  );
}

function PerguntaViewCard({ p }) {
  const opcoes = parseOpcoes(p.opcoes);
  return (
    <div
      style={{
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        opacity: p.ativo === false ? 0.55 : 1,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
        <span
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent)",
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 6,
            padding: "2px 7px",
            whiteSpace: "nowrap",
          }}
        >
          {p.codigo}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          {TIPO_LABEL[p.tipo] ?? p.tipo}
          {p.permite_foto ? " · foto" : ""}
          {p.ativo === false ? " · inactiva" : ""}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700 }}>
          máx {p.pontos_max} pts
        </span>
      </div>
      <p style={{ margin: "0 0 8px", fontSize: 13, lineHeight: 1.45 }}>{p.texto}</p>
      {opcoes.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {opcoes.map((o) => (
            <span
              key={o.valor}
              style={{
                fontSize: 11,
                padding: "4px 8px",
                borderRadius: 6,
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
              }}
            >
              {o.label}: <strong>{o.pontos}</strong> pts
              {o.plano_acao ? " · plano" : ""}
            </span>
          ))}
        </div>
      )}
      {p.tipo === "condicional" && p.resposta_pai_gatilho && (
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--text-secondary)" }}>
          Condicional se pai = «{p.resposta_pai_gatilho}»
        </p>
      )}
    </div>
  );
}

export default function AdminPerguntasModal({ open, onClose, userPerfil = "admin" }) {
  const apiPerfil = userPerfil === "supervisor" ? "supervisor" : "admin";
  const [tipoAvaliador, setTipoAvaliador] = useState("gerente");
  const [secoes, setSecoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modo, setModo] = useState("view");
  const [drafts, setDrafts] = useState({});
  const [nova, setNova] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const [secoesAbertas, setSecoesAbertas] = useState(() => new Set());

  const turnoFetch = useMemo(
    () => turnoModeloPorTipoAvaliador(tipoAvaliador),
    [tipoAvaliador]
  );

  const toggleSecao = (secaoId) => {
    const id = String(secaoId);
    setSecoesAbertas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMsg("");
    try {
      const qs = new URLSearchParams({
        perfil: apiPerfil,
        tipo_avaliador: tipoAvaliador,
        turno: turnoFetch,
      });
      const res = await fetch(`/api/checklist/perguntas?${qs}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Falha ao carregar perguntas.");
      setSecoes(json.secoes ?? []);
      const map = {};
      for (const s of json.secoes ?? []) {
        for (const p of s.perguntas ?? []) {
          map[p.id] = perguntaParaForm(p);
        }
      }
      setDrafts(map);
    } catch (e) {
      setError(e.message ?? "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [tipoAvaliador, turnoFetch, apiPerfil]);

  useEffect(() => {
    if (!open) return;
    setModo("view");
    setNova(null);
    setSecoesAbertas(new Set());
    carregar();
  }, [open, carregar]);

  const todasPerguntas = useMemo(() => {
    const out = [];
    for (const s of secoes) {
      for (const p of s.perguntas ?? []) out.push({ ...p, secao_titulo: s.titulo });
    }
    return out;
  }, [secoes]);

  const salvarEdicoes = async () => {
    setSalvando(true);
    setMsg("");
    setError(null);
    try {
      let n = 0;
      for (const p of todasPerguntas) {
        const d = drafts[p.id];
        if (!d) continue;
        const res = await fetch("/api/checklist/perguntas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ perfil: apiPerfil, pergunta: d }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Falha ao guardar ${d.codigo}.`);
        n += 1;
      }
      setMsg(`${n} pergunta(s) actualizada(s).`);
      setModo("view");
      await carregar();
    } catch (e) {
      setError(e.message ?? "Erro ao guardar.");
    } finally {
      setSalvando(false);
    }
  };

  const salvarNova = async () => {
    if (!nova) return;
    setSalvando(true);
    setMsg("");
    setError(null);
    try {
      const res = await fetch("/api/checklist/perguntas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfil: apiPerfil, pergunta: nova }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Falha ao criar pergunta.");
      setMsg("Pergunta criada com sucesso.");
      setNova(null);
      setModo("view");
      await carregar();
    } catch (e) {
      setError(e.message ?? "Erro ao criar.");
    } finally {
      setSalvando(false);
    }
  };

  const iniciarNova = () => {
    const sec = secoes[0];
    const maxOrd =
      sec?.perguntas?.length > 0
        ? Math.max(...sec.perguntas.map((p) => p.ordem ?? 0))
        : 0;
    setNova(formVazioNovaPergunta(sec?.id ?? "", maxOrd + 1));
    setModo("add");
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 0,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--bg)",
          width: "100%",
          maxWidth: 720,
          maxHeight: "92vh",
          borderRadius: "16px 16px 0 0",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 16px 12px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Perguntas do questionário</h2>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: "none",
                background: "transparent",
                fontSize: 22,
                cursor: "pointer",
                color: "var(--text-secondary)",
                lineHeight: 1,
              }}
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {TIPO_AVALIADOR_OPTS.map(({ val, label }) => (
              <button
                key={val}
                type="button"
                disabled={modo !== "view" && modo !== "add"}
                onClick={() => {
                  setTipoAvaliador(val);
                }}
                style={{
                  flex: "1 1 120px",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1.5px solid",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  borderColor: tipoAvaliador === val ? "var(--accent)" : "var(--border)",
                  background: tipoAvaliador === val ? "var(--accent)" : "transparent",
                  color: tipoAvaliador === val ? "#fff" : "var(--text-secondary)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {modo === "view" && (
              <>
                <button
                  type="button"
                  onClick={() => setModo("edit")}
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: "10px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--accent)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Editar perguntas
                </button>
                <button
                  type="button"
                  onClick={iniciarNova}
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: "10px",
                    borderRadius: 8,
                    border: "1.5px solid var(--accent)",
                    background: "transparent",
                    color: "var(--accent)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  + Nova pergunta
                </button>
              </>
            )}
            {modo === "edit" && (
              <>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={salvarEdicoes}
                  style={{
                    flex: 2,
                    padding: "10px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--accent)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: salvando ? "wait" : "pointer",
                  }}
                >
                  {salvando ? "A guardar…" : "Guardar alterações"}
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => {
                    setModo("view");
                    carregar();
                  }}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              </>
            )}
            {modo === "add" && (
              <button
                type="button"
                onClick={() => {
                  setNova(null);
                  setModo("view");
                }}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Voltar à lista
              </button>
            )}
          </div>
          {msg && (
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#15803d", fontWeight: 600 }}>{msg}</p>
          )}
          {error && (
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#b91c1c" }}>{error}</p>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {loading && (
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>A carregar…</p>
          )}

          {!loading && modo === "add" && nova && (
            <div>
              <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Nova pergunta</h3>
              <PerguntaFormFields
                form={nova}
                onChange={setNova}
                secoes={secoes}
                perguntasNaSecao={
                  secoes.find((s) => s.id === nova.secao_id)?.perguntas ?? []
                }
              />
              <button
                type="button"
                disabled={salvando}
                onClick={salvarNova}
                style={{
                  marginTop: 16,
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  border: "none",
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: salvando ? "wait" : "pointer",
                }}
              >
                {salvando ? "A criar…" : "Criar pergunta"}
              </button>
            </div>
          )}

          {!loading && modo !== "add" && secoes.length === 0 && (
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Nenhuma secção para este turno.
            </p>
          )}

          {!loading &&
            modo !== "add" &&
            secoes.map((sec) => {
              const sid = String(sec.id);
              const aberta = secoesAbertas.has(sid);
              const lista = sec.perguntas ?? [];
              const qtd = lista.length;
              const pontosMaxSecao = lista.reduce(
                (acc, p) =>
                  p.ativo === false || p.ativo === "false"
                    ? acc
                    : acc + (Number(p.pontos_max) || 0),
                0
              );
              return (
                <div
                  key={sec.id}
                  style={{
                    marginBottom: 12,
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "var(--card-bg)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSecao(sec.id)}
                    style={{
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 14px",
                      border: "none",
                      background: aberta ? "var(--accent-soft)" : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        width: 16,
                        color: "var(--text-secondary)",
                        flexShrink: 0,
                      }}
                    >
                      {aberta ? "▼" : "▶"}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--accent)",
                      }}
                    >
                      {sec.titulo}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        flexShrink: 1,
                        minWidth: 0,
                        textAlign: "right",
                        lineHeight: 1.35,
                      }}
                    >
                      {qtd} {qtd === 1 ? "pergunta" : "perguntas"}
                      <span style={{ marginLeft: 6, opacity: 0.92 }}>
                        · Pontuação máxima: {pontosMaxSecao}
                      </span>
                    </span>
                  </button>
                  {aberta && (
                    <div style={{ padding: "0 12px 12px" }}>
                      {modo === "view" &&
                        (qtd > 0 ? (
                          sec.perguntas.map((p) => <PerguntaViewCard key={p.id} p={p} />)
                        ) : (
                          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                            Sem perguntas.
                          </p>
                        ))}
                      {modo === "edit" &&
                        (qtd > 0 ? (
                          sec.perguntas.map((p) => {
                            const d = drafts[p.id] ?? perguntaParaForm(p);
                            return (
                              <div
                                key={p.id}
                                style={{
                                  border: "1px solid var(--border)",
                                  borderRadius: 10,
                                  padding: 12,
                                  marginBottom: 12,
                                  background: "var(--bg)",
                                }}
                              >
                                <PerguntaFormFields
                                  form={d}
                                  onChange={(next) =>
                                    setDrafts((prev) => ({ ...prev, [p.id]: next }))
                                  }
                                  secoes={secoes}
                                  perguntasNaSecao={sec.perguntas ?? []}
                                  readOnly={false}
                                />
                              </div>
                            );
                          })
                        ) : (
                          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                            Sem perguntas.
                          </p>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
