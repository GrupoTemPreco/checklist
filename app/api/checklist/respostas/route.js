import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

/**
 * Body: { items: [{ avaliacao_id, pergunta_id, valor, pontos_obtidos, comentario?, plano_acao?, foto_url? }] }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { items } = body;
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: true, saved: 0 });
    }

    const supabase = createServiceRoleClient();

    const perguntaIds = items.map((i) => i.pergunta_id).filter(Boolean);
    const { data: perguntas } = await supabase
      .from("perguntas")
      .select("id, pontos_max")
      .in("id", perguntaIds);
    const pontosMaxMap = Object.fromEntries(
      (perguntas ?? []).map((p) => [p.id, p.pontos_max])
    );

    for (const it of items) {
      const {
        avaliacao_id,
        pergunta_id,
        valor,
        pontos_obtidos = 0,
        comentario = null,
        plano_acao = null,
        foto_url = null,
      } = it;
      if (!avaliacao_id || !pergunta_id) continue;

      const { error } = await supabase.from("respostas").upsert(
        {
          avaliacao_id,
          pergunta_id,
          valor: valor != null ? String(valor) : "",
          pontos_obtidos,
          pontos_max: String(it.valor) === "nao_consta" ? 0 : (pontosMaxMap[pergunta_id] ?? 0),
          comentario,
          plano_acao,
          foto_url,
        },
        { onConflict: "avaliacao_id,pergunta_id" }
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true, saved: items.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? "Erro ao guardar respostas." }, { status: 500 });
  }
}
