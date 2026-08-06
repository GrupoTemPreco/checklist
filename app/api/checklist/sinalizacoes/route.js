import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/checklist/sinalizacoes?loja=NomeDaUnidade
 * (também aceita ?unidade= como alias)
 * Retorna pendências ativas (status=pendente) da loja.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const loja =
      searchParams.get("loja")?.trim() ||
      searchParams.get("unidade")?.trim() ||
      "";

    if (!loja) {
      return NextResponse.json(
        { error: "loja (ou unidade) é obrigatória." },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("sinalizacoes_pendentes")
      .select(
        `
        id,
        loja,
        pergunta_id,
        tipo_campo,
        texto_original,
        status,
        vezes_nao_resolvido,
        historico_motivos_nao,
        criado_em,
        avaliacao_origem_id
      `
      )
      .eq("loja", loja)
      .eq("status", "pendente")
      .order("criado_em", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const pendencias = (data ?? []).map((row) => ({
      id: row.id,
      loja: row.loja,
      pergunta_id: row.pergunta_id,
      tipo_campo: row.tipo_campo,
      texto_original: row.texto_original,
      status: row.status,
      vezes_nao_resolvido: Number(row.vezes_nao_resolvido) || 0,
      historico_motivos_nao: Array.isArray(row.historico_motivos_nao)
        ? row.historico_motivos_nao
        : [],
      criado_em: row.criado_em,
      avaliacao_origem_id: row.avaliacao_origem_id,
    }));

    return NextResponse.json({ pendencias });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? "Erro ao listar sinalizações." },
      { status: 500 }
    );
  }
}
