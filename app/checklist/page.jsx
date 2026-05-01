import ChecklistApp from "../../components/checklist/ChecklistApp";

export const metadata = { title: "Checklist · Ultra Popular" };

export default function ChecklistPage() {
  // userPerfil virá do seu sistema de auth quando integrar ao shell
  // Por ora, "supervisor" dá acesso a tudo
  return <ChecklistApp userPerfil="supervisor" />;
}
