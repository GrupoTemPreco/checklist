import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";

export async function POST(request) {
  try {
    const body = await request.json();
    const { avaliador_nome, unidade } = body;
    const turnosValidos = ["manha", "tarde", "noite"];
    const turno = turnosValidos.includes(body.turno) ? body.turno : null;
    if (!avaliador_nome?.trim() || !unidade?.trim()) {
      return NextResponse.json({ error: "avaliador_nome e unidade são obrigatórios." }, { status: 400 });
    }
    if (!turno) {
      return NextResponse.json({ error: "turno deve ser manha, tarde ou noite." }, { status: 400 });
    }

    const nome = avaliador_nome.trim();
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from("avaliacoes")
      .insert({
        usuario_id: nome,
        avaliador_nome: nome,
        unidade: unidade.trim(),
        turno,
        checkin_em: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ id: data.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? "Erro ao criar avaliação." }, { status: 500 });
  }
}
