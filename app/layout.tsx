import "./globals.css";

export const metadata = {
  title: "Conversor de Arquivos",
  description: "Converta seus arquivos de forma rápida e local.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}