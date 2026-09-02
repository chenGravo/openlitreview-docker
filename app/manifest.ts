import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '文澜综述 OpenLitReview',
    short_name: '文澜综述',
    description: '按需检索外文学术文献，生成可核查的中文文献综述。',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f3eb',
    theme_color: '#0d6b55',
    lang: 'zh-CN',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  };
}
