import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from "@/components/ui/sonner"
import Script from "next/script"
import './globals.css'
import { BottomNav } from "@/components/ui/bottom-nav"
import { InAppBrowserBarrier } from "@/components/in-app-browser-barrier"
import { Footer } from "@/components/footer"
import { PushNotificationListener } from "@/components/push-notification-listener"

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: '아웃덕',
  description: '게임, 유튜버 관련 오프라인 행사와 온라인 굿즈 정보를 한눈에 확인하세요.',
  generator: 'v0.app',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  verification: {
    google: 'n6Ucrr0nhfs-mCLpYSascviZ3rYHU2dbhrhMEOVonQU',
  },
  other: {
    'naver-site-verification': 'ab18f3ab001c16895d1cb0d1c8d957729406c15d',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className="bg-background">
      <body className="font-sans antialiased flex flex-col min-h-[100dvh] pb-[calc(env(safe-area-inset-bottom,0px)+64px)] md:pb-0">
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
        <InAppBrowserBarrier />
        <PushNotificationListener />
        {children}
        <Footer />
        <BottomNav />
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
