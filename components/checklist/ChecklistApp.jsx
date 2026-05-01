"use client";
import { useState, useEffect, useRef } from "react";

// ─── DADOS MOCKADOS (substituir por chamadas Supabase) ──────────────────────
const SECOES_MOCK = [
  {
    id: "s1", ordem: 1, titulo: "Visão de Consumidor", pontos_max: 160,
    perguntas: [
      { id: "p1_1", codigo: "1.1", texto: "Qual a sensação ao entrar na loja? A loja está atrativa? Sente prazer em comprar?", tipo: "texto_livre", pontos_max: 0, obrigatoria: false, permite_foto: true },
      { id: "p1_2", codigo: "1.2", texto: "Temperatura da loja, está adequada?", tipo: "sim_nao", pontos_max: 10, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Não", valor: "nao", pontos: 0 }, { label: "Sim", valor: "sim", pontos: 10 }] },
      { id: "p1_2_1", codigo: "1.2.1", texto: "Já foi solicitado à supervisão a troca de equipamentos ou manutenção para melhorar a temperatura?", tipo: "condicional", pontos_max: 10, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Não", valor: "nao", pontos: 0, plano_acao: true }, { label: "Sim", valor: "sim", pontos: 10 }],
        pergunta_pai_id: "p1_2", resposta_pai_gatilho: "nao" },
      { id: "p1_3", codigo: "1.3", texto: "As cortinas de ar estão ligadas?", tipo: "sim_nao", pontos_max: 10, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Não", valor: "nao", pontos: 0 }, { label: "Sim", valor: "sim", pontos: 10 }] },
      { id: "p1_4", codigo: "1.4", texto: "A loja está bem iluminada?", tipo: "escala_3", pontos_max: 20, obrigatoria: true, permite_foto: true,
        opcoes: [{ label: "Ruim", valor: "ruim", pontos: 0, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 10, plano_acao: true }, { label: "Bom", valor: "bom", pontos: 20 }] },
      { id: "p1_5", codigo: "1.5", texto: "Os funcionários possuem crachá?", tipo: "sim_nao", pontos_max: 10, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Não", valor: "nao", pontos: 0 }, { label: "Sim", valor: "sim", pontos: 10 }] },
      { id: "p1_6", codigo: "1.6", texto: "Os colaboradores demonstram uma boa postura?", tipo: "sim_nao", pontos_max: 20, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Não conforme", valor: "nao", pontos: 0, plano_acao: true }, { label: "Conforme", valor: "sim", pontos: 20 }] },
      { id: "p1_7", codigo: "1.7", texto: "Qual o nível dos colaboradores? Os mesmos estão conversando paralelamente entre si ou demonstrando falta de empatia?", tipo: "escala_3", pontos_max: 20, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Ruim", valor: "ruim", pontos: 0, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 10, plano_acao: true }, { label: "Bom", valor: "bom", pontos: 20 }] },
      { id: "p1_8", codigo: "1.8", texto: "No modo geral, qual a nota em relação à limpeza da loja?", tipo: "nota_livre", pontos_max: 0, obrigatoria: false, permite_foto: true },
      { id: "p1_9", codigo: "1.9", texto: "No modo geral, de 0 a 10, qual a nota em relação à visão do consumidor?", tipo: "nota_livre", pontos_max: 0, obrigatoria: false, permite_foto: false },
    ]
  },
  {
    id: "s2", ordem: 2, titulo: "Layout e Precificação", pontos_max: 540,
    perguntas: [
      { id: "p2_1", codigo: "2.1", texto: "A loja está sinalizada e com a layoutização das promoções?", tipo: "sim_nao", pontos_max: 30, obrigatoria: true, permite_foto: true,
        opcoes: [{ label: "Não", valor: "nao", pontos: 0, plano_acao: true }, { label: "Sim", valor: "sim", pontos: 30 }] },
      { id: "p2_2", codigo: "2.2", texto: "As seções de Fraldas estão repostas, organizadas e precificadas?", tipo: "escala_5", pontos_max: 50, obrigatoria: true, permite_foto: true,
        opcoes: [{ label: "Péssimo", valor: "pessimo", pontos: 0, plano_acao: true }, { label: "Ruim", valor: "ruim", pontos: 20, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 30, plano_acao: true }, { label: "Bom", valor: "bom", pontos: 40 }, { label: "Ótimo", valor: "otimo", pontos: 50 }] },
      { id: "p2_3", codigo: "2.3", texto: "As seções de Leites estão repostas, organizadas e precificadas?", tipo: "escala_5", pontos_max: 50, obrigatoria: true, permite_foto: true,
        opcoes: [{ label: "Péssimo", valor: "pessimo", pontos: 0, plano_acao: true }, { label: "Ruim", valor: "ruim", pontos: 20, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 30, plano_acao: true }, { label: "Bom", valor: "bom", pontos: 40 }, { label: "Ótimo", valor: "otimo", pontos: 50 }] },
      { id: "p2_4", codigo: "2.4", texto: "As seções de Dermos estão repostas, organizadas e precificadas?", tipo: "escala_5", pontos_max: 50, obrigatoria: true, permite_foto: true,
        opcoes: [{ label: "Péssimo", valor: "pessimo", pontos: 0, plano_acao: true }, { label: "Ruim", valor: "ruim", pontos: 20, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 30 }, { label: "Bom", valor: "bom", pontos: 40 }, { label: "Ótimo", valor: "otimo", pontos: 50 }] },
      { id: "p2_5", codigo: "2.5", texto: "A farmacinha está organizada, com produto e precificada?", tipo: "escala_5", pontos_max: 50, obrigatoria: true, permite_foto: true,
        opcoes: [{ label: "Péssimo", valor: "pessimo", pontos: 0, plano_acao: true }, { label: "Ruim", valor: "ruim", pontos: 20, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 30, plano_acao: true }, { label: "Bom", valor: "bom", pontos: 40 }, { label: "Ótimo", valor: "otimo", pontos: 50 }] },
      { id: "p2_6", codigo: "2.6", texto: "As seções de Conveniência estão repostas, organizadas e precificadas?", tipo: "escala_5", pontos_max: 50, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Péssimo", valor: "pessimo", pontos: 0, plano_acao: true }, { label: "Ruim", valor: "ruim", pontos: 20, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 30, plano_acao: true }, { label: "Bom", valor: "bom", pontos: 40 }, { label: "Ótimo", valor: "otimo", pontos: 50 }] },
      { id: "p2_7", codigo: "2.7", texto: "As seções dos Freezer e Geladeira estão repostas, organizadas e precificadas?", tipo: "escala_5", pontos_max: 30, obrigatoria: true, permite_foto: true,
        opcoes: [{ label: "Péssimo", valor: "pessimo", pontos: 0, plano_acao: true }, { label: "Ruim", valor: "ruim", pontos: 0, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 10, plano_acao: true }, { label: "Bom", valor: "bom", pontos: 20 }, { label: "Ótimo", valor: "otimo", pontos: 30 }] },
      { id: "p2_8", codigo: "2.8", texto: "Qual o nível de reposição dos itens da perfumaria? Está bem reposta ou aparenta estar \"vazia\"?", tipo: "escala_5", pontos_max: 50, obrigatoria: true, permite_foto: true,
        opcoes: [{ label: "Péssimo", valor: "pessimo", pontos: 0, plano_acao: true }, { label: "Ruim", valor: "ruim", pontos: 20, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 30, plano_acao: true }, { label: "Bom", valor: "bom", pontos: 40 }, { label: "Ótimo", valor: "otimo", pontos: 50 }] },
      { id: "p2_9", codigo: "2.9", texto: "Os cestões de medicamentos/perfumaria estão cheios e precificados?", tipo: "escala_5", pontos_max: 50, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Péssimo", valor: "pessimo", pontos: 0, plano_acao: true }, { label: "Ruim", valor: "ruim", pontos: 20, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 30 }, { label: "Bom", valor: "bom", pontos: 40 }, { label: "Ótimo", valor: "otimo", pontos: 50 }] },
      { id: "p2_10", codigo: "2.10", texto: "A precificação no geral fora do balcão está completa? Se não, apontar qual seção precisa de atenção.", tipo: "escala_5", pontos_max: 50, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Péssimo", valor: "pessimo", pontos: 0, plano_acao: true }, { label: "Ruim", valor: "ruim", pontos: 20, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 30, plano_acao: true }, { label: "Bom", valor: "bom", pontos: 40 }, { label: "Ótimo", valor: "otimo", pontos: 50 }] },
      { id: "p2_11", codigo: "2.11", texto: "As pontas de gôndolas estão fazendo sentido com a seção?", tipo: "escala_5", pontos_max: 50, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Péssimo", valor: "pessimo", pontos: 0, plano_acao: true }, { label: "Ruim", valor: "ruim", pontos: 20, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 30 }, { label: "Bom", valor: "bom", pontos: 40 }, { label: "Ótimo", valor: "otimo", pontos: 50 }] },
      { id: "p2_12", codigo: "2.12", texto: "E a limpeza em relação a todos esses pontos?", tipo: "texto_livre", pontos_max: 0, obrigatoria: false, permite_foto: true },
      { id: "p2_13", codigo: "2.13", texto: "No modo geral, de 0 a 10, qual a nota em relação ao layout e à precificação?", tipo: "nota_livre", pontos_max: 0, obrigatoria: false, permite_foto: false },
    ]
  },
  {
    id: "s3", ordem: 3, titulo: "Vendas e Atendimento", pontos_max: 390,
    perguntas: [
      { id: "p3_1", codigo: "3.1", texto: "A equipe no balcão está realizando a abordagem com o cliente usando o padrão Ultra/Maxi?", tipo: "escala_3", pontos_max: 30, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Ruim", valor: "ruim", pontos: 0, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 20, plano_acao: true }, { label: "Bom", valor: "bom", pontos: 30 }] },
      { id: "p3_2", codigo: "3.2", texto: "A equipe no caixa está realizando a abordagem com o cliente usando o padrão Ultra/Maxi?", tipo: "escala_3", pontos_max: 30, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Ruim", valor: "ruim", pontos: 0, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 20, plano_acao: true }, { label: "Bom", valor: "bom", pontos: 30 }] },
      { id: "p3_3", codigo: "3.3", texto: "A equipe está atendendo fora do balcão? (Entregando cestinha, abordagem na perfumaria, na fralda...)", tipo: "escala_5", pontos_max: 50, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Péssimo", valor: "pessimo", pontos: 0, plano_acao: true }, { label: "Ruim", valor: "ruim", pontos: 20, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 30 }, { label: "Bom", valor: "bom", pontos: 40 }, { label: "Ótimo", valor: "otimo", pontos: 50 }] },
      { id: "p3_4", codigo: "3.4", texto: "A equipe está agregando venda? (Em toda área de loja: balcão, perfumaria...) Apontar qual área precisa de atenção.", tipo: "escala_3", pontos_max: 30, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Ruim", valor: "ruim", pontos: 0, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 20, plano_acao: true }, { label: "Bom", valor: "bom", pontos: 30 }] },
      { id: "p3_5", codigo: "3.5", texto: "A equipe pede o CPF para cadastro?", tipo: "sim_nao", pontos_max: 10, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Não", valor: "nao", pontos: 0 }, { label: "Sim", valor: "sim", pontos: 10 }] },
      { id: "p3_6", codigo: "3.6", texto: "Nível de limpeza e conservação dos teclados dos caixas?", tipo: "escala_3", pontos_max: 20, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Ruim", valor: "ruim", pontos: 0 }, { label: "Regular", valor: "regular", pontos: 10 }, { label: "Bom", valor: "bom", pontos: 20 }] },
      { id: "p3_7", codigo: "3.7", texto: "Nível de limpeza e conservação dos teclados dos balcões?", tipo: "escala_3", pontos_max: 20, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Ruim", valor: "ruim", pontos: 0 }, { label: "Regular", valor: "regular", pontos: 10 }, { label: "Bom", valor: "bom", pontos: 20 }] },
      { id: "p3_8", codigo: "3.8", texto: "Como você avalia a limpeza e organização do caixa?", tipo: "escala_5", pontos_max: 50, obrigatoria: true, permite_foto: true,
        opcoes: [{ label: "Péssimo", valor: "pessimo", pontos: 0, plano_acao: true }, { label: "Ruim", valor: "ruim", pontos: 20, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 30, plano_acao: true }, { label: "Bom", valor: "bom", pontos: 40 }, { label: "Ótimo", valor: "otimo", pontos: 50 }] },
      { id: "p3_9", codigo: "3.9", texto: "Como você avalia a limpeza e organização do balcão?", tipo: "escala_5", pontos_max: 50, obrigatoria: true, permite_foto: true,
        opcoes: [{ label: "Péssimo", valor: "pessimo", pontos: 0, plano_acao: true }, { label: "Ruim", valor: "ruim", pontos: 20, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 30 }, { label: "Bom", valor: "bom", pontos: 40 }, { label: "Ótimo", valor: "otimo", pontos: 50 }] },
      { id: "p3_10", codigo: "3.10", texto: "As gavetas dos balcões estão todas funcionando?", tipo: "sim_nao", pontos_max: 10, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Não", valor: "nao", pontos: 0, plano_acao: true }, { label: "Sim", valor: "sim", pontos: 10 }] },
      { id: "p3_11", codigo: "3.11", texto: "As gavetas dos caixas estão todas funcionando?", tipo: "sim_nao", pontos_max: 10, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Não", valor: "nao", pontos: 0, plano_acao: true }, { label: "Sim", valor: "sim", pontos: 10 }] },
      { id: "p3_12", codigo: "3.12", texto: "Os bipadores dos balcões estão todos funcionando?", tipo: "sim_nao", pontos_max: 10, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Não", valor: "nao", pontos: 0, plano_acao: true }, { label: "Sim", valor: "sim", pontos: 10 }] },
      { id: "p3_13", codigo: "3.13", texto: "Os bipadores dos caixas estão todos funcionando?", tipo: "sim_nao", pontos_max: 10, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Não", valor: "nao", pontos: 0, plano_acao: true }, { label: "Sim", valor: "sim", pontos: 10 }] },
      { id: "p3_14", codigo: "3.14", texto: "O TEF está funcionando em todos os caixas?", tipo: "sim_nao", pontos_max: 10, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Não", valor: "nao", pontos: 0 }, { label: "Sim", valor: "sim", pontos: 10 }] },
      { id: "p3_15", codigo: "3.15", texto: "A impressora de cupom fiscal está funcionando em todos os caixas?", tipo: "sim_nao", pontos_max: 10, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Não", valor: "nao", pontos: 0 }, { label: "Sim", valor: "sim", pontos: 10 }] },
      { id: "p3_16", codigo: "3.16", texto: "As cadeiras dos caixas estão todas funcionando e bem conservadas?", tipo: "sim_nao", pontos_max: 10, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Não", valor: "nao", pontos: 0, plano_acao: true }, { label: "Sim", valor: "sim", pontos: 10 }] },
      { id: "p3_17", codigo: "3.17", texto: "No modo geral, de 0 a 10, qual a nota em relação às vendas e atendimento?", tipo: "nota_livre", pontos_max: 0, obrigatoria: false, permite_foto: false },
    ]
  },
  {
    id: "s4", ordem: 4, titulo: "Financeiro", pontos_max: 100,
    perguntas: [
      { id: "p4_1", codigo: "4.1", texto: "A contagem do fundo de cofre bateu? (Sobra acima de R$10 ou qualquer falta = Não conforme)", tipo: "sim_nao", pontos_max: 100, obrigatoria: true, permite_foto: true,
        opcoes: [{ label: "Não conforme", valor: "nao", pontos: 0, plano_acao: true }, { label: "Conforme", valor: "sim", pontos: 100 }] },
    ]
  },
  {
    id: "s5", ordem: 5, titulo: "Processos Gerenciais", pontos_max: 150,
    perguntas: [
      { id: "p5_1", codigo: "5.1", texto: "Como você avalia o grau de conhecimento do gestor nas funções do CAIXA?", tipo: "escala_5", pontos_max: 50, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Péssimo", valor: "pessimo", pontos: 0, plano_acao: true }, { label: "Ruim", valor: "ruim", pontos: 20, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 30, plano_acao: true }, { label: "Bom", valor: "bom", pontos: 40 }, { label: "Ótimo", valor: "otimo", pontos: 50 }] },
      { id: "p5_2", codigo: "5.2", texto: "Como você avalia o grau de conhecimento do gestor nas funções da ADM?", tipo: "escala_5", pontos_max: 50, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Péssimo", valor: "pessimo", pontos: 0, plano_acao: true }, { label: "Ruim", valor: "ruim", pontos: 20, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 30, plano_acao: true }, { label: "Bom", valor: "bom", pontos: 40 }, { label: "Ótimo", valor: "otimo", pontos: 50 }] },
      { id: "p5_3", codigo: "5.3", texto: "Como você avalia o grau de conhecimento do gestor nas funções do ESTOQUISTA?", tipo: "escala_5", pontos_max: 50, obrigatoria: true, permite_foto: false,
        opcoes: [{ label: "Péssimo", valor: "pessimo", pontos: 0, plano_acao: true }, { label: "Ruim", valor: "ruim", pontos: 20, plano_acao: true }, { label: "Regular", valor: "regular", pontos: 30, plano_acao: true }, { label: "Bom", valor: "bom", pontos: 40 }, { label: "Ótimo", valor: "otimo", pontos: 50 }] },
    ]
  },
];

const HISTORICO_MOCK = [
  { id: "av1", avaliador_nome: "Ana Costa", unidade: "Unidade Centro", turno: "manha", percentual: 87.3, nota_total: 1168, nota_maxima: 1340, criado_em: "2026-04-28T08:30:00Z", status: "concluida",
    por_secao: [{ titulo: "Visão de Consumidor", percentual: 92 }, { titulo: "Layout e Precificação", percentual: 84 }, { titulo: "Vendas e Atendimento", percentual: 88 }, { titulo: "Financeiro", percentual: 100 }, { titulo: "Processos Gerenciais", percentual: 73 }] },
  { id: "av2", avaliador_nome: "Carlos Lima", unidade: "Unidade Norte", turno: "tarde", percentual: 71.5, nota_total: 958, nota_maxima: 1340, criado_em: "2026-04-25T14:10:00Z", status: "concluida",
    por_secao: [{ titulo: "Visão de Consumidor", percentual: 68 }, { titulo: "Layout e Precificação", percentual: 72 }, { titulo: "Vendas e Atendimento", percentual: 74 }, { titulo: "Financeiro", percentual: 100 }, { titulo: "Processos Gerenciais", percentual: 60 }] },
  { id: "av3", avaliador_nome: "Fernanda Rocha", unidade: "Unidade Centro", turno: "manha", percentual: 94.1, nota_total: 1261, nota_maxima: 1340, criado_em: "2026-04-22T09:00:00Z", status: "concluida",
    por_secao: [{ titulo: "Visão de Consumidor", percentual: 96 }, { titulo: "Layout e Precificação", percentual: 95 }, { titulo: "Vendas e Atendimento", percentual: 93 }, { titulo: "Financeiro", percentual: 100 }, { titulo: "Processos Gerenciais", percentual: 87 }] },
];

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
        {pergunta.permite_foto && (
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

// ─── VIEW: CHECKLIST (formulário) ───────────────────────────────────────────
function ChecklistView({ onSubmit }) {
  const [step, setStep] = useState("identificacao"); // identificacao | secao | concluido
  const [secaoAtual, setSecaoAtual] = useState(0);
  const [avaliador, setAvaliador] = useState("");
  const [unidade, setUnidade] = useState("");
  const [respostas, setRespostas] = useState({});

  const secao = SECOES_MOCK[secaoAtual];

  const perguntasVisiveis = secao?.perguntas.filter(p => {
    if (p.tipo !== "condicional") return true;
    const pai = respostas[p.pergunta_pai_id];
    return pai?.valor === p.resposta_pai_gatilho;
  }) || [];

  const pontosSecao = perguntasVisiveis.reduce((acc, p) => acc + (respostas[p.id]?.pontos || 0), 0);
  const pontosMaxSecao = perguntasVisiveis.reduce((acc, p) => acc + p.pontos_max, 0);
  const totalRespondidas = perguntasVisiveis.filter(p => respostas[p.id]?.valor !== undefined && respostas[p.id]?.valor !== "").length;
  const totalObrigatorias = perguntasVisiveis.filter(p => p.obrigatoria).length;
  const respondidasObrig = perguntasVisiveis.filter(p => p.obrigatoria && respostas[p.id]?.valor !== undefined && respostas[p.id]?.valor !== "").length;

  const podeProsseguir = respondidasObrig >= totalObrigatorias;

  const handleResposta = (pId, val) => setRespostas(r => ({ ...r, [pId]: val }));

  const totalGeral = SECOES_MOCK.reduce((acc, s) => {
    return acc + s.perguntas.filter(p => {
      if (p.tipo !== "condicional") return true;
      return respostas[p.pergunta_pai_id]?.valor === p.resposta_pai_gatilho;
    }).reduce((a, p) => a + (respostas[p.id]?.pontos || 0), 0);
  }, 0);

  const maxGeral = SECOES_MOCK.reduce((acc, s) => acc + s.pontos_max, 0);

  if (step === "identificacao") {
    const podeIniciar = Boolean(avaliador.trim() && unidade.trim());
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: "var(--accent)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 24 }}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12l2 2 4-4"/></svg>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Avaliação de Loja</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--text-secondary)" }}>Turno da manhã — Supervisão</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!avaliador.trim() || !unidade.trim()) return;
            setStep("secao");
          }}
          style={{ display: "flex", flexDirection: "column", gap: 0 }}
        >
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Seu nome</label>
            <input value={avaliador} onChange={e => setAvaliador(e.target.value)} placeholder="Ex: Ana Costa" autoComplete="name"
              style={{ width: "100%", borderRadius: 8, border: "1.5px solid var(--border)", padding: "12px 14px", fontSize: 15, background: "var(--card-bg)", color: "var(--text-primary)", boxSizing: "border-box" }} />
          </div>

          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Unidade</label>
            <input value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="Ex: Unidade Centro" autoComplete="organization"
              style={{ width: "100%", borderRadius: 8, border: "1.5px solid var(--border)", padding: "12px 14px", fontSize: 15, background: "var(--card-bg)", color: "var(--text-primary)", boxSizing: "border-box" }} />
          </div>

          <button type="submit" disabled={!podeIniciar}
            style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: podeIniciar ? "var(--accent)" : "var(--border)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: podeIniciar ? "pointer" : "not-allowed" }}>
            Iniciar Avaliação
          </button>
        </form>
      </div>
    );
  }

  if (step === "concluido") {
    const pct = Math.round((totalGeral / maxGeral) * 100);
    const cor = getScoreColor(pct);
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 16px", textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: getScoreBg(pct), border: `3px solid ${cor}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 32, fontWeight: 800, color: cor }}>
          {pct}%
        </div>
        <h2 style={{ margin: "0 0 8px", color: "var(--text-primary)" }}>Avaliação concluída!</h2>
        <p style={{ color: "var(--text-secondary)", margin: "0 0 24px" }}>{totalGeral} de {maxGeral} pontos</p>

        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 24, textAlign: "left" }}>
          {SECOES_MOCK.map(s => {
            const pts = s.perguntas.reduce((a, p) => a + (respostas[p.id]?.pontos || 0), 0);
            const pctS = Math.round((pts / s.pontos_max) * 100);
            return (
              <div key={s.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{s.titulo}</span>
                  <span style={{ fontSize: 13, color: getScoreColor(pctS), fontWeight: 700 }}>{pts}/{s.pontos_max}</span>
                </div>
                <ProgressBar value={pts} max={s.pontos_max} color={getScoreColor(pctS)} />
              </div>
            );
          })}
        </div>

        <button type="button" onClick={() => { setStep("identificacao"); setRespostas({}); setSecaoAtual(0); setAvaliador(""); setUnidade(""); }}
          style={{ width: "100%", padding: 14, borderRadius: 10, border: "1.5px solid var(--accent)", background: "transparent", color: "var(--accent)", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          Nova avaliação
        </button>
      </div>
    );
  }

  console.log(step);
  return (
    <div style={{ maxWidth: 540, margin: "0 auto" }}>
      {/* Header fixo com progresso */}
      <div style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)", padding: "12px 16px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Seção {secaoAtual + 1} de {SECOES_MOCK.length}</span>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{secao.titulo}</h2>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: getScoreColor(pontosMaxSecao > 0 ? Math.round((pontosSecao/pontosMaxSecao)*100) : 0) }}>{pontosSecao}</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>/{pontosMaxSecao}pts</span>
          </div>
        </div>
        {/* Progresso geral (bolinhas) */}
        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
          {SECOES_MOCK.map((s, i) => (
            <div key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, background: i < secaoAtual ? "var(--accent)" : i === secaoAtual ? "#93c5fd" : "var(--border)" }} />
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          {respondidasObrig}/{totalObrigatorias} obrigatórias respondidas
        </div>
      </div>

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
          onClick={() => {
            if (secaoAtual < SECOES_MOCK.length - 1) setSecaoAtual(s => s + 1);
            else setStep("concluido");
          }}
          disabled={!podeProsseguir}
          style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: podeProsseguir ? "var(--accent)" : "var(--border)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: podeProsseguir ? "pointer" : "not-allowed" }}>
          {secaoAtual < SECOES_MOCK.length - 1 ? "Próxima seção →" : "Concluir avaliação"}
        </button>
      </div>
    </div>
  );
}

// ─── VIEW: DASHBOARD ─────────────────────────────────────────────────────────
function DashboardView() {
  const [filtro, setFiltro] = useState("todas");
  const [detalhe, setDetalhe] = useState(null);

  const unidades = [...new Set(HISTORICO_MOCK.map(a => a.unidade))];
  const avaliacoesFiltradas = filtro === "todas" ? HISTORICO_MOCK : HISTORICO_MOCK.filter(a => a.unidade === filtro);
  const mediaGeral = avaliacoesFiltradas.length > 0
    ? Math.round(avaliacoesFiltradas.reduce((a, v) => a + v.percentual, 0) / avaliacoesFiltradas.length)
    : 0;

  if (detalhe) {
    const av = detalhe;
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}>
        <button type="button" onClick={() => setDetalhe(null)} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 16, padding: 0 }}>
          ← Voltar
        </button>
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: 18, color: "var(--text-primary)" }}>{av.unidade}</h2>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>{av.avaliador_nome} · {formatDate(av.criado_em)}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: getScoreColor(av.percentual) }}>{av.percentual}%</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{av.nota_total}/{av.nota_maxima} pts</div>
            </div>
          </div>
        </div>

        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "var(--text-primary)" }}>Resultado por seção</h3>
          {av.por_secao.map((s, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{s.titulo}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: getScoreColor(s.percentual) }}>{s.percentual}%</span>
              </div>
              <ProgressBar value={s.percentual} max={100} color={getScoreColor(s.percentual)} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Média geral", value: `${mediaGeral}%`, color: getScoreColor(mediaGeral) },
          { label: "Avaliações", value: avaliacoesFiltradas.length },
          { label: "Unidades", value: unidades.length },
        ].map((k, i) => (
          <div key={i} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color || "var(--text-primary)" }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtro */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {["todas", ...unidades].map(u => (
          <button type="button" key={u} onClick={() => setFiltro(u)}
            style={{ whiteSpace: "nowrap", padding: "7px 14px", borderRadius: 20, border: "1.5px solid", fontSize: 13, fontWeight: 500, cursor: "pointer",
              borderColor: filtro === u ? "var(--accent)" : "var(--border)",
              background: filtro === u ? "var(--accent)" : "transparent",
              color: filtro === u ? "#fff" : "var(--text-secondary)" }}>
            {u === "todas" ? "Todas as unidades" : u}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {avaliacoesFiltradas.map(av => (
          <button type="button" key={av.id} onClick={() => setDetalhe(av)}
            style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px", cursor: "pointer", textAlign: "left", width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{av.unidade}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{av.avaliador_nome} · {formatDate(av.criado_em)}</div>
              </div>
              <div style={{ background: getScoreBg(av.percentual), border: `1.5px solid ${getScoreColor(av.percentual)}`, borderRadius: 8, padding: "6px 12px" }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: getScoreColor(av.percentual) }}>{av.percentual}%</span>
              </div>
            </div>
            <ProgressBar value={av.percentual} max={100} color={getScoreColor(av.percentual)} />
          </button>
        ))}
      </div>
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

      {aba === "checklist" ? <ChecklistView /> : <DashboardView />}
    </div>
  );
}
