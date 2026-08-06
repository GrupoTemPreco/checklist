/**
 * one-time: diagnóstico da RPC sinalizacao_marcar_nao_resolvido
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const raw = readFileSync(resolve(".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    let v = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

function normalizeSupabaseUrl(raw) {
  if (raw == null || typeof raw !== "string") return "";
  let u = raw.trim().replace(/^["']|["']$/g, "");
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    return new URL(u).origin;
  } catch {
    return u.replace(/\/+$/, "");
  }
}

loadEnv();

const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
console.log("url origin:", url);
const supabase = createClient(url, key, { auth: { persistSession: false } });

const LOJA_PREFIX = "TESTE SINALIZACAO E2E";

async function main() {
  const { data: pendencias, error } = await supabase
    .from("sinalizacoes_pendentes")
    .select("*")
    .like("loja", `${LOJA_PREFIX}%`)
    .eq("status", "pendente")
    .order("criado_em", { ascending: false })
    .limit(3);

  console.log("pendencias:", JSON.stringify({ pendencias, error }, null, 2));

  const p = pendencias?.[0];
  if (!p) {
    console.log("Nenhuma pendência de teste encontrada");
    return;
  }

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    "sinalizacao_marcar_nao_resolvido",
    {
      p_loja: p.loja,
      p_pergunta_id: p.pergunta_id,
      p_tipo_campo: "comentario",
      p_motivo: "motivo diagnostico direto",
      p_avaliacao_id: p.avaliacao_origem_id,
    }
  );
  console.log("RPC result:", JSON.stringify({ rpcData, rpcErr }, null, 2));

  const { data: after, error: err2 } = await supabase
    .from("sinalizacoes_pendentes")
    .select("id, vezes_nao_resolvido, historico_motivos_nao, status, loja, pergunta_id")
    .eq("id", p.id)
    .maybeSingle();
  console.log("after RPC:", JSON.stringify({ after, err2 }, null, 2));

  const agora = new Date().toISOString();
  const { data: updFiltros, error: errFiltros } = await supabase
    .from("sinalizacoes_pendentes")
    .update({ ultima_verificacao_em: agora })
    .eq("loja", p.loja)
    .eq("pergunta_id", p.pergunta_id)
    .eq("tipo_campo", "comentario")
    .eq("status", "pendente")
    .select("id");
  console.log("update por filtros:", JSON.stringify({ updFiltros, errFiltros }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
