import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  AVALIACAO_DETALHE_SELECT,
  mapAvaliacaoDetalhe,
} from "@/lib/avaliacao-load";

export const dynamic = "force-dynamic";

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

    qSec = qSec.eq("turno", "tarde");

    const { data: secoesRaw, error: errSecoes } = await qSec.order("ordem", {
      ascending: true,
    });

    if (errSecoes) {
      return NextResponse.json({ error: errSecoes.message }, { status: 400 });
    }

    let q = supabase
      .from("avaliacoes")
      .select(AVALIACAO_DETALHE_SELECT)
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

    const avaliacoes = (avalRaw ?? []).map(mapAvaliacaoDetalhe);

    return NextResponse.json({ secoes, avaliacoes });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? "Erro ao listar avaliações." },
      { status: 500 }
    );
  }
}
