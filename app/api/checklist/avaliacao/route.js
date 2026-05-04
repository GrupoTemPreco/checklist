import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";

export async function DELETE(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const avaliacao_id = body.avaliacao_id;
    if (!avaliacao_id || typeof avaliacao_id !== "string") {
      return NextResponse.json({ error: "avaliacao_id é obrigatório." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    const { error } = await supabase.from("avaliacoes").delete().eq("id", avaliacao_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? "Erro ao eliminar avaliação." },
      { status: 500 }
    );
  }
}
