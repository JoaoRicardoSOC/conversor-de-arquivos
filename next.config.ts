/** @type {import('next').NextConfig} */
const nextConfig = {
  // Estes cabeçalhos liberam o SharedArrayBuffer para o FFmpeg.wasm funcionar
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
};

export default nextConfig;