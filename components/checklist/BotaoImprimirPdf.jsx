"use client";

export default function BotaoImprimirPdf() {
  return (
    <button
      type="button"
      className="no-print imprimir-pdf-btn"
      onClick={() => window.print()}
    >
      Imprimir / Baixar PDF
    </button>
  );
}
