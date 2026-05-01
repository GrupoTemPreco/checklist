export const metadata = {
  title: "Checklist — Ultra Popular",
  description: "Avaliação de Loja · Turno da Manhã",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fff" }}>
        {children}
      </body>
    </html>
  );
}
