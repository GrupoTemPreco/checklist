import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/avaliacoes/[id]/simular?perfil=admin
 *
 * Somente leitura: chama RPCs de simulação. Não grava nada.
 * O perfil vem da URL (shell) e é falsificável — não é barreira de segurança real.
 */
export async function GET(
  request: Request,
  { params }: { params: { id?: string } }
) {
  try {
    const id = params?.id;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const perfil = searchParams.get("perfil")?.trim() || "";
    if (perfil !== "admin") {
      return NextResponse.json(
        { error: "Apenas admin pode simular pontuação." },
        { status: 403 }
      );
    }

    const supabase = createServiceRoleClient();

    const [resumoRes, detalheRes] = await Promise.all([
      supabase.rpc("simular_nota_avaliacao", { p_avaliacao_id: id }),
      supabase.rpc("simular_nota_avaliacao_detalhe", { p_avaliacao_id: id }),
    ]);

    if (resumoRes.error) {
      return NextResponse.json(
        { error: resumoRes.error.message || "Falha em simular_nota_avaliacao." },
        { status: 400 }
      );
    }
    if (detalheRes.error) {
      return NextResponse.json(
        {
          error:
            detalheRes.error.message || "Falha em simular_nota_avaliacao_detalhe.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      resumo: Array.isArray(resumoRes.data) ? resumoRes.data : resumoRes.data ?? [],
      detalhe: Array.isArray(detalheRes.data)
        ? detalheRes.data
        : detalheRes.data ?? [],
    });
  } catch (e: unknown) {
    console.error(e);
    const message =
      e instanceof Error ? e.message : "Erro ao simular pontuação.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
