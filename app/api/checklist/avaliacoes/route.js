import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { mapRespostasParaApi } from "@/lib/avaliacoes-resposta-map";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tipoRaw = searchParams.get("tipo_avaliador");
    const tipo =
      tipoRaw === "gerente" || tipoRaw === "supervisor" ? tipoRaw : null;
    const unidade = searchParams.get("unidade")?.trim() || null;

    const supabase = createServiceRoleClient();

    let qSec = supabase
      .from("secoes")
      .select("id, ordem, titulo, pontos_max")
      .eq("ativo", true);

    if (tipo === "gerente") {
      qSec = qSec.eq("turno", "manha");
    } else if (tipo === "supervisor") {
      qSec = qSec.eq("turno", "tarde");
    }

    const { data: secoesRaw, error: errSecoes } = await qSec.order("ordem", {
      ascending: true,
    });

    if (errSecoes) {
      return NextResponse.json({ error: errSecoes.message }, { status: 400 });
    }

    let q = supabase
      .from("avaliacoes")
      .select(
        `
        id,
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
          perguntas ( secao_id, texto, codigo, tipo, opcoes )
        )
      `
      )
      .eq("status", "concluida");

    if (tipo) {
      q = q.eq("tipo_avaliador", tipo);
    }
    if (unidade) {
      q = q.eq("unidade", unidade);
    }

    const { data: avalRaw, error: errAval } = await q
      .order("checkout_em", { ascending: false, nullsFirst: false })
      .order("criado_em", { ascending: false });

    if (errAval) {
      return NextResponse.json({ error: errAval.message }, { status: 400 });
    }

    const secoes = (secoesRaw ?? []).map((s) => ({
      id: s.id,
      ordem: s.ordem,
      titulo: s.titulo,
      pontos_max: Number(s.pontos_max) || 0,
    }));

    const avaliacoes = (avalRaw ?? []).map((av) => ({
      id: av.id,
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
    }));

    return NextResponse.json({ secoes, avaliacoes });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? "Erro ao listar avaliações." },
      { status: 500 }
    );
  }
}
