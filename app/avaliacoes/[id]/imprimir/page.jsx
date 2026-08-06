import "./print.css";
import BotaoImprimirPdf from "@/components/checklist/BotaoImprimirPdf";
import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  loadAvaliacaoById,
  loadSecoesAtivasMontagem,
  assertAcessoAvaliacao,
  secoesComRespostasParaMontar,
  montarPorSecao,
} from "@/lib/avaliacao-load";
import { turnoModeloPorTipoAvaliador } from "@/lib/avaliacoes-resposta-map";

export const dynamic = "force-dynamic";

const TEXTO_TURNO = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };

function textoTurno(t) {
  if (t == null || t === "") return "—";
  return TEXTO_TURNO[t] ?? String(t);
}

function textoTipo(tipo) {
  if (tipo === "supervisor") return "Supervisor";
  if (tipo === "gerente") return "Gerente";
  return tipo ? String(tipo) : "—";
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function firstParam(v) {
  return Array.isArray(v) ? v[0] : v;
}

function fotoUrlEstatica(fotoUrl) {
  const url = fotoUrl != null ? String(fotoUrl).trim() : "";
  if (!url || url.startsWith("blob:")) return null;
  return url;
}

function isNaoConsta(r) {
  return String(r?.resposta_label ?? "") === "nao_consta";
}

export const metadata = { title: "Imprimir avaliação · Checklist" };

export default async function ImprimirAvaliacaoPage({ params, searchParams }) {
  const id = params?.id;
  const perfil = String(firstParam(searchParams?.perfil) ?? "").trim();
  const uid = String(firstParam(searchParams?.uid) ?? "").trim();

  let avaliacao = null;
  let secoes = [];
  let erro = null;
  let statusErro = 500;

  try {
    if (!id) {
      erro = "Avaliação inválida.";
      statusErro = 400;
    } else {
      const supabase = createServiceRoleClient();
      avaliacao = await loadAvaliacaoById(supabase, id);
      if (!avaliacao) {
        erro = "Avaliação não encontrada.";
        statusErro = 404;
      } else {
        assertAcessoAvaliacao({ perfil, uid, avaliacao });
        secoes = await loadSecoesAtivasMontagem(supabase);
      }
    }
  } catch (e) {
    erro = e.message ?? "Erro ao carregar avaliação.";
    statusErro = e.status ?? 500;
  }

  if (erro || !avaliacao) {
    return (
      <div className="avaliacao-print-erro">
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>Não foi possível abrir a impressão</h1>
        <p style={{ color: "#64748b", marginBottom: 16 }}>{erro}</p>
        <p style={{ fontSize: 13, color: "#94a3b8" }}>Código {statusErro}</p>
        <a href="/checklist" className="imprimir-voltar no-print" style={{ marginTop: 16 }}>
          Voltar ao checklist
        </a>
      </div>
    );
  }

  const secoesMontagem = secoesComRespostasParaMontar(
    secoes,
    avaliacao.respostas,
    turnoModeloPorTipoAvaliador(avaliacao.tipo_avaliador)
  );
  const linhasPorSecao = montarPorSecao(secoesMontagem, avaliacao.respostas);

  const respostasPorSecao = new Map();
  for (const r of avaliacao.respostas ?? []) {
    const sid = r.secao_id != null ? String(r.secao_id) : "";
    if (!sid) continue;
    if (!respostasPorSecao.has(sid)) respostasPorSecao.set(sid, []);
    respostasPorSecao.get(sid).push(r);
  }

  const pct = Math.round(Number(avaliacao.percentual ?? 0));
  const dataAvaliacao = formatDate(avaliacao.checkout_em || avaliacao.criado_em);

  return (
    <div className="avaliacao-print">
      <div className="imprimir-toolbar no-print">
        <a href="/checklist" className="imprimir-voltar">
          ← Voltar
        </a>
        <BotaoImprimirPdf />
      </div>

      <header className="avaliacao-print-header">
        <h1>{avaliacao.unidade || "Loja"}</h1>
        <dl className="avaliacao-print-meta">
          <div>
            <dt>Avaliador</dt>
            <dd>{avaliacao.avaliador_nome || "—"}</dd>
          </div>
          <div>
            <dt>Tipo de avaliador</dt>
            <dd>{textoTipo(avaliacao.tipo_avaliador)}</dd>
          </div>
          <div>
            <dt>Turno</dt>
            <dd>{textoTurno(avaliacao.turno)}</dd>
          </div>
          <div>
            <dt>Data da avaliação</dt>
            <dd>{dataAvaliacao}</dd>
          </div>
          <div>
            <dt>Nota final</dt>
            <dd className="avaliacao-print-nota">
              {pct}%
              {avaliacao.nota_total != null && avaliacao.nota_maxima != null
                ? ` (${avaliacao.nota_total}/${avaliacao.nota_maxima} pts)`
                : ""}
            </dd>
          </div>
        </dl>
      </header>

      {linhasPorSecao.map((sec) => {
        const perguntas = respostasPorSecao.get(String(sec.secao_id)) ?? [];
        return (
          <section key={sec.secao_id} className="avaliacao-print-secao">
            <div className="avaliacao-print-secao-titulo">
              <h2>{sec.titulo}</h2>
              <span>
                {sec.pontos_obtidos_secao ?? 0}/{sec.pontos_max_secao ?? 0} pts
                {sec.pontos_max_secao > 0 ? ` · ${sec.percentual}%` : ""}
              </span>
            </div>

            {perguntas.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                Sem respostas nesta seção.
              </p>
            ) : (
              perguntas.map((r, idx) => {
                const foto = fotoUrlEstatica(r.foto_url);
                const naoConsta = isNaoConsta(r);
                return (
                  <div
                    key={`${r.pergunta_id}-${idx}`}
                    className="avaliacao-print-pergunta"
                  >
                    <div>
                      <span className="avaliacao-print-codigo">
                        {r.pergunta_codigo || "—"}
                      </span>
                      <span style={{ fontSize: 13, lineHeight: 1.45 }}>
                        {r.pergunta_texto || "Pergunta"}
                      </span>
                    </div>

                    {naoConsta ? (
                      <p className="avaliacao-print-resposta">
                        <span className="avaliacao-print-nao-consta">
                          Não consta
                        </span>
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 12,
                            fontWeight: 500,
                            color: "#64748b",
                          }}
                        >
                          (não entra na nota)
                        </span>
                      </p>
                    ) : (
                      <>
                        <p className="avaliacao-print-resposta">
                          {r.resposta_exibicao ?? r.resposta_label ?? "—"}
                        </p>
                        {r.pergunta_tipo !== "texto_livre" &&
                          r.pergunta_tipo !== "nota_livre" &&
                          r.comentario && (
                            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
                              Comentário: {r.comentario}
                            </p>
                          )}
                        {r.plano_acao && (
                          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#c2410c" }}>
                            Plano de ação: {r.plano_acao}
                          </p>
                        )}
                        <p style={{ margin: "3px 0 0", fontSize: 11, color: "#64748b" }}>
                          +{r.pontos_obtidos ?? 0} pts
                        </p>
                      </>
                    )}

                    {foto && (
                      <a
                        href={foto}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="avaliacao-print-foto-link"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={foto}
                          alt={`Foto — ${r.pergunta_codigo || "resposta"}`}
                          className="avaliacao-print-foto"
                        />
                        <span className="avaliacao-print-foto-hint">
                          Clique para ver em tamanho real
                        </span>
                      </a>
                    )}
                  </div>
                );
              })
            )}
          </section>
        );
      })}
    </div>
  );
}
