# Checklist Ultra Popular

App de avaliação de loja para o turno da manhã. Projeto standalone deployado na Vercel, integrado ao shell via link.

## Stack

- **Next.js 14** (App Router)
- **Supabase** — banco de dados, auth e storage de fotos
- **React** — sem biblioteca de UI, estilo inline

---

## Configuração local

```bash
# 1. Clone e instale
git clone <seu-repo>
cd checklist-ultra-popular
npm install

# 2. Crie o arquivo de variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas keys do Supabase

# 3. Sobe o banco
# No painel do Supabase → SQL Editor → cole o conteúdo de schema_checklist.sql

# 4. Rode
npm run dev
```

Acesse em `http://localhost:3000`

---

## Estrutura de pastas

```
checklist-ultra-popular/
├── app/
│   ├── layout.js              # Root layout
│   ├── page.js                # Redireciona pra /checklist
│   └── checklist/
│       └── page.jsx           # Rota principal
├── components/
│   └── checklist/
│       └── ChecklistApp.jsx   # App completo (checklist + dashboard)
├── lib/
│   ├── supabase.js            # Client + funções de banco
│   └── data.js                # Questionário completo (mock)
└── schema_checklist.sql       # Schema do Supabase
```

---

## Deploy na Vercel

1. Sobe o projeto no GitHub
2. Importa no Vercel
3. Adiciona as variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
4. Deploy automático

---

## Conectar ao Supabase (quando pronto)

Hoje o app usa dados mock em `lib/data.js`. Para conectar de verdade:

**Em `ChecklistApp.jsx`**, substitua o import:
```js
// antes
import { SECOES } from "@/lib/data";

// depois
import { fetchSecoes } from "@/lib/supabase";
// e chama fetchSecoes() num useEffect
```

Todas as funções já estão prontas em `lib/supabase.js`:
- `fetchSecoes()` — busca perguntas do banco
- `criarAvaliacao()` — abre uma nova avaliação
- `salvarResposta()` — salva/atualiza resposta individual
- `concluirAvaliacao()` — fecha e calcula nota
- `fetchAvaliacoes()` — lista pra o dashboard
- `uploadFoto()` — faz upload pro Storage

---

## Permissões

A prop `userPerfil` em `app/checklist/page.jsx` controla o acesso:

```jsx
// gerente: só vê checklist
<ChecklistApp userPerfil="gerente" />

// supervisor / admin: vê checklist + dashboard de análise
<ChecklistApp userPerfil="supervisor" />
```

Quando integrar ao shell, passa o perfil vindo do seu sistema de auth.
