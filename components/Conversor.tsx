'use client';

import { useState, useRef, useEffect } from 'react';
import { FileVideo, FileImage, FileText, ChevronDown, ArrowRight, Music, UploadCloud, X, Loader2, Download, CheckCircle } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// 1. MEGA DICIONÁRIO DE CONVERSÕES
const regrasDeConversao: Record<string, string[]> = {
  // Vídeos
  'MP4': ['MOV', 'AVI', 'MKV', 'WEBM', 'GIF', 'MP3', 'WAV', 'OGG', 'M4A'],
  'MOV': ['MP4', 'AVI', 'MKV', 'WEBM', 'GIF', 'MP3', 'WAV', 'OGG', 'M4A'],
  'AVI': ['MP4', 'MOV', 'MKV', 'WEBM', 'GIF', 'MP3', 'WAV', 'OGG', 'M4A'],
  'MKV': ['MP4', 'MOV', 'AVI', 'WEBM', 'GIF', 'MP3', 'WAV', 'OGG', 'M4A'],
  'WEBM': ['MP4', 'MOV', 'AVI', 'MKV', 'GIF', 'MP3', 'WAV', 'OGG', 'M4A'],
  
  // Áudios
  'MP3': ['WAV', 'OGG', 'M4A'],
  'WAV': ['MP3', 'OGG', 'M4A'],
  'OGG': ['MP3', 'WAV', 'M4A'],
  'M4A': ['MP3', 'WAV', 'OGG'],

  // Imagens
  'JPG': ['PNG', 'WEBP', 'GIF', 'BMP', 'PDF'],
  'JPEG': ['PNG', 'WEBP', 'GIF', 'BMP', 'PDF'], // Adicionado JPEG
  'PNG': ['JPG', 'JPEG', 'WEBP', 'GIF', 'BMP', 'PDF'],
  'WEBP': ['JPG', 'JPEG', 'PNG', 'GIF', 'BMP'],
  'BMP': ['JPG', 'JPEG', 'PNG', 'WEBP', 'GIF'],
  'GIF': ['MP4', 'MOV', 'JPG', 'PNG', 'WEBP'], // GIF é especial (vai pra vídeo ou imagem)

  // Documentos
  'PDF': ['JPG', 'JPEG', 'PNG'],
};

// 2. ÍCONES DINÂMICOS ATUALIZADOS
const getIcone = (extensao: string) => {
  const videos = ['MOV', 'MP4', 'AVI', 'MKV', 'WEBM'];
  const audios = ['MP3', 'WAV', 'OGG', 'M4A'];
  const imagens = ['JPG', 'JPEG', 'PNG', 'WEBP', 'GIF', 'BMP'];

  if (videos.includes(extensao)) return <FileVideo className="w-5 h-5 text-gray-400" />;
  if (imagens.includes(extensao)) return <FileImage className="w-5 h-5 text-gray-400" />;
  if (audios.includes(extensao)) return <Music className="w-5 h-5 text-gray-400" />;
  return <FileText className="w-5 h-5 text-gray-400" />;
};

// 3. IDENTIFICADOR INTELIGENTE DE TIPOS (MIME TYPES)
const obterMimeType = (extensao: string) => {
  const tipos: Record<string, string> = {
    'MP4': 'video/mp4', 'MOV': 'video/quicktime', 'AVI': 'video/x-msvideo', 
    'MKV': 'video/x-matroska', 'WEBM': 'video/webm',
    'MP3': 'audio/mpeg', 'WAV': 'audio/wav', 'OGG': 'audio/ogg', 'M4A': 'audio/mp4',
    'JPG': 'image/jpeg', 'JPEG': 'image/jpeg', 'PNG': 'image/png', 
    'WEBP': 'image/webp', 'GIF': 'image/gif', 'BMP': 'image/bmp',
    'PDF': 'application/pdf'
  };
  return tipos[extensao] || 'application/octet-stream';
};

export default function Conversor() {
  const [origem, setOrigem] = useState<string>('MOV');
  const [destino, setDestino] = useState<string>('MP4');
  const [menuOrigemAberto, setMenuOrigemAberto] = useState(false);
  const [menuDestinoAberto, setMenuDestinoAberto] = useState(false);
  
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [emConversao, setEmConversao] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [concluido, setConcluido] = useState(false);
  
  const ffmpegRef = useRef(new FFmpeg());
  const [ffmpegCarregado, setFfmpegCarregado] = useState(false);
  const [arquivosConvertidos, setArquivosConvertidos] = useState<{nome: string, url: string}[]>([]);

  const formatosOrigem = Object.keys(regrasDeConversao);
  const formatosDestino = regrasDeConversao[origem];

  useEffect(() => {
    carregarFFmpeg();
  }, []);

  const carregarFFmpeg = async () => {
    try {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      const ffmpeg = ffmpegRef.current;
      
      ffmpeg.on('progress', ({ progress }) => {
        setProgresso(Math.round(progress * 100));
      });

      ffmpeg.on('log', ({ message }) => console.log('FFmpeg:', message));

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      setFfmpegCarregado(true);
    } catch (err) {
      console.error("Erro ao carregar o FFmpeg:", err);
      setErro("Não foi possível carregar o motor de conversão. Verifique sua internet.");
    }
  };

  const handleTrocarOrigem = (novoFormato: string) => {
    setOrigem(novoFormato);
    setDestino(regrasDeConversao[novoFormato][0]);
    setMenuOrigemAberto(false);
    setArquivos([]);
    setErro(null);
    resetarConversao();
  };

  const processarArquivos = (files: FileList | null) => {
    setErro(null);
    if (!files) return;

    const novosArquivos = Array.from(files);
    const arquivosValidos: File[] = [];

    for (const file of novosArquivos) {
      const extensaoArquivo = file.name.split('.').pop()?.toUpperCase() || '';
      
      // TRUQUE DO JPEG: Permite que JPG e JPEG sejam aceitos juntos
      const isJpg = ['JPG', 'JPEG'].includes(extensaoArquivo) && ['JPG', 'JPEG'].includes(origem);

      if (extensaoArquivo === origem || isJpg) {
        arquivosValidos.push(file);
      } else {
        setErro(`Ops! O arquivo "${file.name}" não corresponde ao formato .${origem}.`);
      }
    }

    if (arquivosValidos.length > 0) setArquivos((prev) => [...prev, ...arquivosValidos]);
  };

  const resetarConversao = () => {
    setEmConversao(false);
    setProgresso(0);
    setConcluido(false);
    setArquivosConvertidos([]);
  };

  const iniciarConversao = async () => {
    if (!ffmpegCarregado) {
      setErro("O motor de conversão ainda está a carregar.");
      return;
    }

    setEmConversao(true);
    setProgresso(0);
    const ffmpeg = ffmpegRef.current;
    const novosConvertidos = [];

    try {
      for (const arquivo of arquivos) {
        const nomeEntrada = `entrada_${Date.now()}.${origem.toLowerCase()}`;
        const nomeSaida = `saida_${Date.now()}.${destino.toLowerCase()}`;

        await ffmpeg.writeFile(nomeEntrada, await fetchFile(arquivo));

        let argumentosFfmpeg = ['-i', nomeEntrada];
        
        // Mantém a cópia rápida (4K) para MOV e MP4
        if (['MOV', 'MP4'].includes(origem) && ['MOV', 'MP4'].includes(destino)) {
          argumentosFfmpeg.push('-c', 'copy');
        } 
        // Lógica para extrair áudio de qualquer vídeo
        else if (['MP3', 'WAV', 'OGG', 'M4A'].includes(destino)) {
          argumentosFfmpeg.push('-vn'); // Remove o vídeo
          if (destino === 'MP3') argumentosFfmpeg.push('-c:a', 'libmp3lame', '-q:a', '2');
        }
        
        argumentosFfmpeg.push(nomeSaida);

        await ffmpeg.exec(argumentosFfmpeg);
        
        const data = await ffmpeg.readFile(nomeSaida) as Uint8Array;
        
        // Puxa o Mime Type correto para o navegador não bugar o arquivo
        const mimeType = obterMimeType(destino);

        const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        // Limpa a extensão original (mesmo se for .jpeg) e adiciona a nova
        const nomeSemExtensao = arquivo.name.substring(0, arquivo.name.lastIndexOf('.'));
        novosConvertidos.push({
          nome: `${nomeSemExtensao}.${destino.toLowerCase()}`,
          url: url
        });

        await ffmpeg.deleteFile(nomeEntrada);
        await ffmpeg.deleteFile(nomeSaida);
      }

      setArquivosConvertidos(novosConvertidos);
      setConcluido(true);
    } catch (error) {
      console.error("Erro detalhado da conversão:", error);
      setErro("Ocorreu um erro durante a conversão. Verifique se o arquivo não está corrompido.");
    } finally {
      setEmConversao(false);
    }
  };

  const descarregarTudo = () => {
    arquivosConvertidos.forEach(arq => {
      const a = document.createElement('a');
      a.href = arq.url;
      a.download = arq.nome;
      a.click();
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 font-sans antialiased selection:bg-white selection:text-black bg-black">
      <div className="max-w-3xl w-full space-y-10 text-center">
        
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Conversor de Arquivos
          </h1>
          <p className="text-gray-400 text-lg">
            {!ffmpegCarregado ? "Preparando motor de conversão..." : "Selecione os formatos e faça o upload para começar."}
          </p>
        </div>

        <div className={`flex flex-col md:flex-row items-center justify-center gap-6 ${emConversao || concluido || !ffmpegCarregado ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="relative w-48 z-20">
            <button onClick={() => { setMenuOrigemAberto(!menuOrigemAberto); setMenuDestinoAberto(false); }} className="w-full flex items-center justify-between bg-[#0a0a0a] border border-gray-800 hover:bg-gray-900 text-white px-5 py-4 rounded-xl transition-all">
              <div className="flex items-center gap-3">{getIcone(origem)}<span className="font-semibold">{origem}</span></div>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${menuOrigemAberto ? 'rotate-180' : ''}`} />
            </button>
            {menuOrigemAberto && (
              <div className="absolute top-full mt-2 w-full bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto custom-scrollbar">
                {formatosOrigem.map((ext) => (
                  <button key={ext} onClick={() => handleTrocarOrigem(ext)} className="w-full flex items-center gap-3 text-left px-5 py-3 hover:bg-gray-800 text-white transition-colors">
                    {getIcone(ext)}<span>{ext}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <ArrowRight className="w-6 h-6 text-gray-600 hidden md:block" />

          <div className="relative w-48 z-10">
            <button onClick={() => { setMenuDestinoAberto(!menuDestinoAberto); setMenuOrigemAberto(false); }} className="w-full flex items-center justify-between bg-[#0a0a0a] border border-gray-800 hover:bg-gray-900 text-white px-5 py-4 rounded-xl transition-all">
              <div className="flex items-center gap-3">{getIcone(destino)}<span className="font-semibold">{destino}</span></div>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${menuDestinoAberto ? 'rotate-180' : ''}`} />
            </button>
            {menuDestinoAberto && (
              <div className="absolute top-full mt-2 w-full bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto custom-scrollbar">
                {formatosDestino.map((ext) => (
                  <button key={ext} onClick={() => { setDestino(ext); setMenuDestinoAberto(false); }} className="w-full flex items-center gap-3 text-left px-5 py-3 hover:bg-gray-800 text-white transition-colors">
                    {getIcone(ext)}<span>{ext}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-full max-w-2xl mx-auto mt-8">
          {!emConversao && !concluido && (
            <>
              <input type="file" multiple className="hidden" ref={inputRef} onChange={(e) => processarArquivos(e.target.files)} />
              <div 
                onClick={() => ffmpegCarregado && inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); if (ffmpegCarregado) setArrastando(true); }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastando(false); if (ffmpegCarregado) processarArquivos(e.dataTransfer.files); }}
                className={`border-2 border-dashed rounded-2xl p-12 transition-all duration-300 flex flex-col items-center justify-center gap-4
                  ${!ffmpegCarregado ? 'opacity-50 cursor-not-allowed border-gray-800 bg-[#0a0a0a]' : arrastando ? 'border-white bg-gray-900/50 cursor-pointer' : 'border-gray-800 bg-[#0a0a0a] hover:border-gray-600 hover:bg-gray-900/30 cursor-pointer'}`}
              >
                {!ffmpegCarregado ? <Loader2 className="w-12 h-12 text-gray-500 animate-spin" /> : <UploadCloud className={`w-12 h-12 ${arrastando ? 'text-white' : 'text-gray-500'}`} />}
                <div>
                  <p className="text-white font-medium text-lg">{!ffmpegCarregado ? 'Baixando ferramentas locais...' : 'Clique ou arraste seus arquivos aqui'}</p>
                  {ffmpegCarregado && <p className="text-gray-500 text-sm mt-1">Apenas arquivos .{origem} {origem === 'JPG' ? '(ou .JPEG) ' : ''}são permitidos</p>}
                </div>
              </div>

              {erro && <div className="mt-4 p-4 bg-red-950/30 border border-red-900/50 text-red-400 rounded-xl text-sm">{erro}</div>}
            </>
          )}

          {arquivos.length > 0 && (
            <div className="mt-6 text-left space-y-4">
              {!concluido && !emConversao && (
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-medium pl-1">Prontos para converter ({arquivos.length})</h3>
                  <button 
                    onClick={iniciarConversao}
                    className="bg-white text-black hover:bg-gray-200 px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    Converter Agora
                  </button>
                </div>
              )}

              {emConversao && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Convertendo de forma segura...</span>
                    <span className="text-white font-medium">{progresso}%</span>
                  </div>
                  <div className="w-full bg-gray-900 rounded-full h-2">
                    <div className="bg-white h-2 rounded-full transition-all duration-300" style={{ width: `${Math.max(0, Math.min(progresso, 100))}%` }}></div>
                  </div>
                </div>
              )}

              {concluido && (
                <div className="flex flex-col items-center justify-center p-8 bg-green-950/20 border border-green-900/50 rounded-2xl gap-4">
                  <CheckCircle className="w-16 h-16 text-green-500" />
                  <h2 className="text-2xl font-bold text-white">Conversão Concluída!</h2>
                  <p className="text-gray-400">Seus arquivos estão prontos para download.</p>
                  <div className="flex gap-4 mt-2">
                    <button onClick={descarregarTudo} className="bg-white text-black hover:bg-gray-200 px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2">
                      <Download className="w-5 h-5" /> Baixar Tudo
                    </button>
                    <button onClick={() => { setArquivos([]); resetarConversao(); }} className="bg-[#0a0a0a] text-white border border-gray-800 hover:bg-gray-900 px-6 py-3 rounded-xl font-semibold transition-colors">
                      Converter Mais
                    </button>
                  </div>
                </div>
              )}

              {!concluido && arquivos.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-[#0a0a0a] border border-gray-800 p-4 rounded-xl">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {getIcone(origem)}
                    <span className="text-gray-300 truncate">{file.name}</span>
                  </div>
                  {!emConversao && (
                    <button onClick={() => setArquivos(arquivos.filter((_, i) => i !== index))} className="text-gray-500 hover:text-red-400 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}