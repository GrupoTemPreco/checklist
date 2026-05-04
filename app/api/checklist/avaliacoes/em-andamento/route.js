import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const nome = searchParams.get("nome")?.trim();
    const unidade = searchParams.get("unidade")?.trim();
    const tipoRaw = searchParams.get("tipo_avaliador")?.trim();
    const tipo_avaliador =
      tipoRaw === "gerente" || tipoRaw === "supervisor" ? tipoRaw : null;
    if (!nome || !unidade) {
      return NextResponse.json(
        { error: "nome e unidade são obrigatórios." },
        { status: 400 }
      );
    }
    if (!tipo_avaliador) {
      return NextResponse.json(
        { error: "tipo_avaliador deve ser gerente ou supervisor." },
        { status: 400 }
      );
    }

    const turnosValidos = ["manha", "tarde", "noite"];
    const turnoRaw = searchParams.get("turno")?.trim();
    const turno = turnosValidos.includes(turnoRaw) ? turnoRaw : null;
    if (!turno) {
      return NextResponse.json(
        { error: "turno deve ser manha, tarde ou noite." },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from("avaliacoes")
      .select(
        `
        id,
        avaliador_nome,
        unidade,
        turno,
        status,
        checkin_em,
        criado_em,
        tipo_avaliador,
        respostas (
          pergunta_id,
          valor,
          pontos_obtidos,
          comentario,
          plano_acao,
          foto_url
        )
      `
      )
      .eq("status", "em_andamento")
      .eq("avaliador_nome", nome)
      .eq("unidade", unidade)
      .eq("tipo_avaliador", tipo_avaliador)
      .eq("turno", turno)
      .order("checkin_em", { ascending: false, nullsFirst: false })
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ avaliacao: null });
    }

    const respostasFlat = (data.respostas ?? []).map((r) => ({
      pergunta_id: r.pergunta_id,
      valor: r.valor != null ? String(r.valor) : "",
      pontos_obtidos: Number(r.pontos_obtidos) || 0,
      comentario: r.comentario ?? "",
      plano_acao: r.plano_acao ?? "",
      foto_url: r.foto_url ?? "",
    }));

    const { respostas: _drop, ...avHead } = data;

    return NextResponse.json({
      avaliacao: {
        ...avHead,
        respostas: respostasFlat,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? "Erro ao consultar avaliação em andamento." },
      { status: 500 }
    );
  }
}
