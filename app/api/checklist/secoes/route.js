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
