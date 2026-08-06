/** Autosave de checklist em progresso (localStorage). */

const PREFIX = "checklist-draft-";

function hojeYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function uidKeyPart(uid) {
  const s = uid != null ? String(uid).trim() : "";
  return s || "anon";
}

export function draftStorageKey({ uid, tipoAvaliador, turno, data }) {
  const dia = data || hojeYYYYMMDD();
  const tipo = tipoAvaliador === "supervisor" ? "supervisor" : "gerente";
  const t = turno === "tarde" || turno === "noite" ? turno : "manha";
  return `${PREFIX}${uidKeyPart(uid)}-${tipo}-${t}-${dia}`;
}

/** Remove URLs blob: (não sobrevivem a reload). */
function sanitizarRespostas(respostas) {
  const out = {};
  for (const [id, r] of Object.entries(respostas ?? {})) {
    if (!r || typeof r !== "object") continue;
    const foto =
      r.foto_url && typeof r.foto_url === "string" && !r.foto_url.startsWith("blob:")
        ? r.foto_url
        : r.foto_url && String(r.foto_url).startsWith("blob:")
          ? ""
          : r.foto_url || "";
    out[id] = {
      valor: r.valor ?? "",
      pontos: Number(r.pontos) || 0,
      comentario: r.comentario ?? "",
      plano_acao: r.plano_acao ?? "",
      foto_url: foto || "",
    };
  }
  return out;
}

function respostasTemConteudo(respostas) {
  return Object.values(respostas ?? {}).some((r) => {
    if (!r) return false;
    if (r.valor !== undefined && r.valor !== null && String(r.valor).trim() !== "") return true;
    if (r.comentario && String(r.comentario).trim()) return true;
    if (r.plano_acao && String(r.plano_acao).trim()) return true;
    if (r.foto_url && String(r.foto_url).trim() && !String(r.foto_url).startsWith("blob:")) return true;
    return false;
  });
}

export function saveChecklistDraft(payload) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const respostas = sanitizarRespostas(payload.respostas);
    if (!payload.avaliacaoId && !respostasTemConteudo(respostas)) return false;

    const key = draftStorageKey({
      uid: payload.uid,
      tipoAvaliador: payload.tipoAvaliador,
      turno: payload.turno,
    });
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      data: hojeYYYYMMDD(),
      uid: uidKeyPart(payload.uid),
      tipoAvaliador: payload.tipoAvaliador === "supervisor" ? "supervisor" : "gerente",
      turno: payload.turno === "tarde" || payload.turno === "noite" ? payload.turno : "manha",
      avaliacaoId: payload.avaliacaoId ?? null,
      secaoAtual: Number(payload.secaoAtual) || 0,
      avaliador: payload.avaliador ?? "",
      unidadeNome: payload.unidadeNome ?? "",
      adminModoChecklist: payload.adminModoChecklist ?? null,
      respostas,
    };
    window.localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadChecklistDraft({ uid, tipoAvaliador, turno }) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const key = draftStorageKey({ uid, tipoAvaliador, turno });
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    if (data.data !== hojeYYYYMMDD()) return null;
    if (!respostasTemConteudo(data.respostas) && !data.avaliacaoId) return null;
    return data;
  } catch {
    return null;
  }
}

/** Qualquer rascunho de hoje para este uid (mais recente por savedAt). */
export function findChecklistDraftToday(uid) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const prefix = `${PREFIX}${uidKeyPart(uid)}-`;
    const hoje = hojeYYYYMMDD();
    let best = null;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(prefix) || !key.endsWith(`-${hoje}`)) continue;
      try {
        const data = JSON.parse(window.localStorage.getItem(key));
        if (!data || data.data !== hoje) continue;
        if (!respostasTemConteudo(data.respostas) && !data.avaliacaoId) continue;
        if (!best || String(data.savedAt || "") > String(best.savedAt || "")) {
          best = data;
        }
      } catch {
        /* ignore entrada inválida */
      }
    }
    return best;
  } catch {
    return null;
  }
}

export function clearChecklistDraft({ uid, tipoAvaliador, turno }) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const key = draftStorageKey({ uid, tipoAvaliador, turno });
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function clearChecklistDraftPayload(draft) {
  if (!draft) return;
  clearChecklistDraft({
    uid: draft.uid,
    tipoAvaliador: draft.tipoAvaliador,
    turno: draft.turno,
  });
}

/** Remove rascunhos cuja data no nome da chave não é hoje. */
export function purgeOldChecklistDrafts() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const hoje = hojeYYYYMMDD();
    const toRemove = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      if (!key.endsWith(`-${hoje}`)) toRemove.push(key);
    }
    for (const key of toRemove) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}
