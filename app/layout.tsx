import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '文澜综述｜私人学术文献综述入口',
  description: '按需检索外文学术文献，生成可核查的中文文献综述。',
  applicationName: '文澜综述',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg', apple: '/icon-192.png' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '文澜综述',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
