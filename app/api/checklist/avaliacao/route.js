import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

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

export async function PATCH(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const avaliacao_id = body.avaliacao_id;
    const unidade = body.unidade != null ? String(body.unidade).trim() : "";
    if (!avaliacao_id || typeof avaliacao_id !== "string") {
      return NextResponse.json({ error: "avaliacao_id é obrigatório." }, { status: 400 });
    }
    if (!unidade) {
      return NextResponse.json({ error: "unidade é obrigatória." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from("avaliacoes")
      .update({ unidade })
      .eq("id", avaliacao_id)
      .select("id, unidade")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, avaliacao: data });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? "Erro ao actualizar avaliação." },
      { status: 500 }
    );
  }
}
