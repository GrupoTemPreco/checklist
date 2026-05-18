import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { loadSecoesPerguntasAdmin } from "@/lib/checklist-queries";
import {
  assertPerfilAdmin,
  turnoModeloFromTipoAvaliador,
  validarPayloadPergunta,
  TURNOS_VALIDOS,
} from "@/lib/perguntas-admin";

export const dynamic = "force-dynamic";

function erroResponse(e) {
  const status = e.status ?? 500;
  return NextResponse.json({ error: e.message ?? "Erro interno." }, { status });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    assertPerfilAdmin(searchParams.get("perfil")?.trim());

    const tipo = searchParams.get("tipo_avaliador")?.trim();
    let turno = searchParams.get("turno")?.trim();
    if (!turno && tipo) {
      turno = turnoModeloFromTipoAvaliador(tipo);
    }
    if (!TURNOS_VALIDOS.includes(turno)) {
      return NextResponse.json(
        { error: "turno ou tipo_avaliador inválido (manha/tarde/noite ou gerente/supervisor)." },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const secoes = await loadSecoesPerguntasAdmin(supabase, turno);
    return NextResponse.json({ secoes, turno });
  } catch (e) {
    console.error(e);
    return erroResponse(e);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    assertPerfilAdmin(body?.perfil?.trim());

    const payload = validarPayloadPergunta(body?.pergunta ?? body, { isCreate: true });
    const supabase = createServiceRoleClient();

    const { data: secao, error: errSec } = await supabase
      .from("secoes")
      .select("id, turno")
      .eq("id", payload.secao_id)
      .maybeSingle();
    if (errSec) throw errSec;
    if (!secao) {
      return NextResponse.json({ error: "Secção não encontrada." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("perguntas")
      .insert({
        secao_id: payload.secao_id,
        ordem: payload.ordem,
        codigo: payload.codigo,
        texto: payload.texto,
        tipo: payload.tipo,
        opcoes: payload.opcoes,
        pontos_max: payload.pontos_max,
        obrigatoria: payload.obrigatoria,
        plano_acao_obrigatorio: payload.plano_acao_obrigatorio,
        permite_foto: payload.permite_foto,
        pergunta_pai_id: payload.pergunta_pai_id,
        resposta_pai_gatilho: payload.resposta_pai_gatilho,
        ativo: payload.ativo,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ pergunta: data });
  } catch (e) {
    console.error(e);
    return erroResponse(e);
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    assertPerfilAdmin(body?.perfil?.trim());

    const payload = validarPayloadPergunta(body?.pergunta ?? body, { isCreate: false });
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from("perguntas")
      .update({
        secao_id: payload.secao_id,
        ordem: payload.ordem,
        codigo: payload.codigo,
        texto: payload.texto,
        tipo: payload.tipo,
        opcoes: payload.opcoes,
        pontos_max: payload.pontos_max,
        obrigatoria: payload.obrigatoria,
        plano_acao_obrigatorio: payload.plano_acao_obrigatorio,
        permite_foto: payload.permite_foto,
        pergunta_pai_id: payload.pergunta_pai_id,
        resposta_pai_gatilho: payload.resposta_pai_gatilho,
        ativo: payload.ativo,
        atualizado_em: payload.atualizado_em,
      })
      .eq("id", payload.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Pergunta não encontrada." }, { status: 404 });
    }
    return NextResponse.json({ pergunta: data });
  } catch (e) {
    console.error(e);
    return erroResponse(e);
  }
}
