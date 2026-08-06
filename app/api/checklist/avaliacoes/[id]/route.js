import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  loadAvaliacaoById,
  loadSecoesAtivasMontagem,
  assertAcessoAvaliacao,
} from "@/lib/avaliacao-load";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const id = params?.id;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const perfil = searchParams.get("perfil")?.trim() || "";
    const uid = searchParams.get("uid")?.trim() || "";

    const supabase = createServiceRoleClient();
    const avaliacao = await loadAvaliacaoById(supabase, id);
    if (!avaliacao) {
      return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });
    }

    try {
      assertAcessoAvaliacao({ perfil, uid, avaliacao });
    } catch (e) {
      return NextResponse.json(
        { error: e.message ?? "Sem permissão." },
        { status: e.status ?? 403 }
      );
    }

    const secoes = await loadSecoesAtivasMontagem(supabase);
    return NextResponse.json({ avaliacao, secoes });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? "Erro ao carregar avaliação." },
      { status: 500 }
    );
  }
}
