'use client';

import dynamic from 'next/dynamic';

// DICA DE OURO: Garanta que a palavra "Conversor" aqui comece com a letra 
// maiúscula ou minúscula exatamente igual ao nome do arquivo que você criou!
const ConversorDinamico = dynamic(() => import('../components/Conversor'), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen bg-[#000000] flex items-center justify-center">
      <p className="text-gray-400">Iniciando sistema...</p>
    </main>
  )
});

export default function Home() {
  return <ConversorDinamico />;
}