/** Consultas checklist partilhadas entre lib/supabase (anon) e rotas API (service role). */

export async function loadUnidades(client) {
  const { data, error } = await client
    .from("unidades")
    .select("codigo, nome, grupo")
    .order("grupo", { ascending: true })
    .order("nome", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function loadSecoesComPerguntas(client, turno) {
  if (!turno || !["manha", "tarde", "noite"].includes(turno)) {
    throw new Error("turno deve ser manha, tarde ou noite.");
  }
  const { data, error } = await client
    .from("secoes")
    .select(`
      *,
      perguntas (*)
    `)
    .eq("ativo", true)
    .eq("turno", turno)
    .order("ordem")
    .order("ordem", { referencedTable: "perguntas" });

  if (error) throw error;
  return data ?? [];
}
