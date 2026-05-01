import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── PERGUNTAS ──────────────────────────────────────────────────────────────

export async function fetchSecoes() {
  const { data, error } = await supabase
    .from("secoes")
    .select(`
      *,
      perguntas (*)
    `)
    .eq("ativo", true)
    .order("ordem")
    .order("ordem", { referencedTable: "perguntas" });

  if (error) throw error;
  return data;
}

// ─── AVALIAÇÕES ─────────────────────────────────────────────────────────────

export async function criarAvaliacao({ usuario_id, avaliador_nome, unidade, turno = "manha" }) {
  const { data, error } = await supabase
    .from("avaliacoes")
    .insert({ usuario_id, avaliador_nome, unidade, turno, checkin_em: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function salvarResposta({ avaliacao_id, pergunta_id, valor, pontos_obtidos, comentario, plano_acao, foto_url }) {
  const { data, error } = await supabase
    .from("respostas")
    .upsert(
      { avaliacao_id, pergunta_id, valor, pontos_obtidos, comentario, plano_acao, foto_url },
      { onConflict: "avaliacao_id,pergunta_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function concluirAvaliacao(avaliacao_id) {
  const { error: updError } = await supabase
    .from("avaliacoes")
    .update({ status: "concluida", checkout_em: new Date().toISOString() })
    .eq("id", avaliacao_id);

  if (updError) throw updError;

  // Dispara função que calcula nota
  await supabase.rpc("calcular_nota_avaliacao", { p_avaliacao_id: avaliacao_id });
}

export async function fetchAvaliacoes({ unidade } = {}) {
  let query = supabase
    .from("avaliacoes")
    .select(`
      *,
      respostas (
        pontos_obtidos,
        pergunta_id,
        perguntas ( secao_id, pontos_max )
      )
    `)
    .eq("status", "concluida")
    .order("criado_em", { ascending: false });

  if (unidade) query = query.eq("unidade", unidade);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ─── UPLOAD DE FOTO ─────────────────────────────────────────────────────────

export async function uploadFoto(file, avaliacaoId, perguntaId) {
  const ext = file.name.split(".").pop();
  const path = `${avaliacaoId}/${perguntaId}.${ext}`;

  const { error } = await supabase.storage
    .from("checklist-fotos")
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage
    .from("checklist-fotos")
    .getPublicUrl(path);

  return data.publicUrl;
}
