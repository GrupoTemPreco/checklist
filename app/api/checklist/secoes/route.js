import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { loadSecoesComPerguntas } from "@/lib/checklist-queries";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const turno = searchParams.get("turno");
    if (!turno) {
      return NextResponse.json({ error: "Parâmetro turno é obrigatório." }, { status: 400 });
    }
    const supabase = createServiceRoleClient();
    const secoes = await loadSecoesComPerguntas(supabase, turno);
    return NextResponse.json({ secoes });
  } catch (e) {
    const msg = e.message ?? "Erro ao carregar secções.";
    const status = msg.includes("turno") ? 400 : 500;
    console.error(e);
    return NextResponse.json({ error: msg }, { status });
  }
}

/**
 * PATCH { perfil, id, ativo }
 * Atualiza apenas secoes.ativo (não propaga para perguntas filhas).
 * Apenas admin. Schema de secoes não tem atualizado_em — só grava ativo.
 */
export async function PATCH(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const perfil = String(body?.perfil ?? "").trim();
    if (perfil !== "admin") {
      return NextResponse.json(
        { error: "Apenas admin pode ativar/inativar secções." },
        { status: 403 }
      );
    }

    const id = body?.id != null ? String(body.id).trim() : "";
    if (!id) {
      return NextResponse.json({ error: "id da secção é obrigatório." }, { status: 400 });
    }
    if (typeof body.ativo !== "boolean") {
      return NextResponse.json(
        { error: "ativo deve ser boolean (true|false)." },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Não toca em perguntas, respostas ou avaliacoes.
    const { data, error } = await supabase
      .from("secoes")
      .update({ ativo: body.ativo })
      .eq("id", id)
      .select("id, titulo, ativo, turno, ordem, pontos_max")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: "Secção não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ secao: data });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? "Erro ao actualizar secção." },
      { status: 500 }
    );
  }
}
