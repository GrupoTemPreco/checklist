import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { mapRespostasParaApi } from "@/lib/avaliacoes-resposta-map";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const perfil = searchParams.get("perfil")?.trim();
    const uid = searchParams.get("uid")?.trim() || "";
    const unidadeFiltro = searchParams.get("unidade")?.trim() || null;

    if (perfil !== "gerente" && perfil !== "supervisor") {
      return NextResponse.json(
        { error: "perfil deve ser gerente ou supervisor." },
        { status: 400 }
      );
    }

    if (perfil === "gerente" && !uid) {
      return NextResponse.json(
        { error: "uid é obrigatório para perfil gerente." },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data: secoesRaw, error: errSecoes } = await supabase
      .from("secoes")
      .select("id, ordem, titulo, pontos_max, turno")
      .eq("ativo", true)
      .order("ordem", { ascending: true });

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
          foto_url,
          perguntas ( secao_id, texto, codigo, tipo, opcoes )
        )
      `
      )
      .eq("status", "concluida");

    if (perfil === "gerente") {
      q = q.eq("usuario_id", uid);
    }

    if (unidadeFiltro) {
      q = q.eq("unidade", unidadeFiltro);
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
      turno: s.turno != null ? String(s.turno) : null,
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
      { error: e.message ?? "Erro ao listar histórico." },
      { status: 500 }
    );
  }
}
