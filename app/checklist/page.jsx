import ChecklistApp from "../../components/checklist/ChecklistApp";

export const metadata = { title: "Checklist · Ultra Popular" };

export default function ChecklistPage({ searchParams }) {
  const raw = searchParams?.perfil;
  const perfil = Array.isArray(raw) ? raw[0] : raw;
  const rawUid = searchParams?.uid;
  const uid = Array.isArray(rawUid) ? rawUid[0] : rawUid;
  const userPerfil =
    perfil === "admin" || perfil === "supervisor" ? perfil : "gerente";
  return <ChecklistApp userPerfil={userPerfil} uid={uid} />;
}
