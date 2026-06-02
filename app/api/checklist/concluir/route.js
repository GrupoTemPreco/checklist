import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const { avaliacao_id } = body;
    if (!avaliacao_id) {
      return NextResponse.json({ error: "avaliacao_id é obrigatório." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    const { error: updError } = await supabase
      .from("avaliacoes")
      .update({ status: "concluida", checkout_em: new Date().toISOString() })
      .eq("id", avaliacao_id);

    if (updError) {
      return NextResponse.json({ error: updError.message }, { status: 400 });
    }

    const { error: rpcError } = await supabase.rpc("calcular_nota_avaliacao", {
      p_avaliacao_id: avaliacao_id,
    });
    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 400 });
    }

    const { data: avRow, error: selError } = await supabase
      .from("avaliacoes")
      .select("nota_total, nota_maxima, percentual")
      .eq("id", avaliacao_id)
      .single();

    if (selError) {
      return NextResponse.json({ error: selError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      nota_total: avRow?.nota_total ?? null,
      nota_maxima: avRow?.nota_maxima ?? null,
      percentual: avRow?.percentual ?? null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? "Erro ao concluir avaliação." }, { status: 500 });
  }
}
