import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { processarSinalizacoesNoConcluir } from "@/lib/sinalizacoes";

export const dynamic = "force-dynamic";

/**
 * Body:
 * {
 *   avaliacao_id: string,
 *   items?: Array<{
 *     pergunta_id: string,
 *     comentario?: string,
 *     plano_acao?: string,
 *     sinalizar_comentario?: boolean,
 *     sinalizar_plano_acao?: boolean,
 *     verificacao_comentario?: 'sim' | 'nao' | null,
 *     motivo_comentario?: string,
 *     verificacao_plano_acao?: 'sim' | 'nao' | null,
 *     motivo_plano_acao?: string,
 *   }>
 * }
 *
 * `items` é opcional (UI Prompt 2). Sem items, só conclui e calcula nota.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { avaliacao_id } = body;
    const items = Array.isArray(body.items) ? body.items : [];

    if (!avaliacao_id) {
      return NextResponse.json({ error: "avaliacao_id é obrigatório." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    const { data: avAntes, error: errAv } = await supabase
      .from("avaliacoes")
      .select("id, unidade, status")
      .eq("id", avaliacao_id)
      .maybeSingle();

    if (errAv) {
      return NextResponse.json({ error: errAv.message }, { status: 400 });
    }
    if (!avAntes) {
      return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });
    }

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

    let sinalizacoes = { processados: 0 };
    if (items.length > 0) {
      try {
        sinalizacoes = await processarSinalizacoesNoConcluir(supabase, {
          loja: avAntes.unidade,
          avaliacaoId: avaliacao_id,
          items,
        });
      } catch (sigErr) {
        console.error("Erro ao processar sinalizações:", sigErr);
        return NextResponse.json(
          {
            error:
              sigErr.message ??
              "Avaliação concluída, mas falhou ao processar sinalizações.",
          },
          { status: 400 }
        );
      }
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
      sinalizacoes_processadas: sinalizacoes.processados ?? 0,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? "Erro ao concluir avaliação." }, { status: 500 });
  }
}
