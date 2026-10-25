import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LYC Arena — Discord Web Base',
  description: 'Interface completa do Discord Web (tema escuro) para o projeto LYC Arena',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="h-full antialiased dark">
      <body className="h-screen w-screen overflow-hidden bg-[#1e1f22]">
        {children}
      </body>
    </html>
  );
}
