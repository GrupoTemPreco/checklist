import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const perfil = searchParams.get("perfil");
    const uid = searchParams.get("uid");

    const supabase = createServiceRoleClient();

    let q = supabase
      .from("unidades")
      .select("codigo, nome, grupo")
      .order("grupo", { ascending: true })
      .order("nome", { ascending: true });

    // gerente (+ uid): só unidades onde este utilizador é o gerente
    // supervisor (ou sem filtro gerente): todas as unidades
    if (perfil === "gerente" && uid != null) {
      q = q.eq("gerente_uid", uid);
    }

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ unidades: data ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? "Erro ao carregar unidades." }, { status: 500 });
  }
}
