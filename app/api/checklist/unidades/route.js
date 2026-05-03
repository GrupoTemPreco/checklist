import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { loadUnidades } from "@/lib/checklist-queries";

export async function GET() {
  try {
    const supabase = createServiceRoleClient();
    const unidades = await loadUnidades(supabase);
    return NextResponse.json({ unidades });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? "Erro ao carregar unidades." }, { status: 500 });
  }
}
