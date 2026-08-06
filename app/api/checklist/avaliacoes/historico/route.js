import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  AVALIACAO_DETALHE_SELECT,
  mapAvaliacaoDetalhe,
  loadSecoesAtivasMontagem,
} from "@/lib/avaliacao-load";

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
    const secoes = await loadSecoesAtivasMontagem(supabase);

    let q = supabase
      .from("avaliacoes")
      .select(AVALIACAO_DETALHE_SELECT)
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

    const avaliacoes = (avalRaw ?? []).map(mapAvaliacaoDetalhe);

    return NextResponse.json({ secoes, avaliacoes });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? "Erro ao listar histórico." },
      { status: 500 }
    );
  }
}
