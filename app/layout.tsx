import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from "@/components/ui/sonner"
import Script from "next/script"
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: '행사 & 굿즈 - 오프라인 행사, 온라인 굿즈 정보',
  description: '게임, 유튜버 관련 오프라인 행사와 온라인 굿즈 정보를 한눈에 확인하세요.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className="bg-background">
      <body className="font-sans antialiased">
        <style dangerouslySetInnerHTML={{ __html: `
          html, body, [data-scroll-locked] {
            padding-right: 0px !important;
            margin-right: 0px !important;
          }
          [style*="padding-right"] {
            padding-right: 0px !important;
          }
          [style*="margin-right"] {
            margin-right: 0px !important;
          }
        `}} />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
        <Toaster />
        {process.env.NEXT_PUBLIC_KAKAO_MAP_KEY && (
          <Script
            src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY.trim()}&libraries=services&autoload=false`}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  )
}
