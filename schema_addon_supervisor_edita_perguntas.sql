-- Rode no SQL Editor do Supabase se as políticas actuais só permitem admin.
-- Permite a supervisores as mesmas operações em perguntas (e secções, para consistência futura).

drop policy if exists "admin edita perguntas" on public.perguntas;

create policy "admin ou supervisor edita perguntas"
  on public.perguntas for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.perfil in ('admin', 'supervisor')
    )
  );

drop policy if exists "admin edita secoes" on public.secoes;

create policy "admin ou supervisor edita secoes"
  on public.secoes for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.perfil in ('admin', 'supervisor')
    )
  );
