import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '🥟 News Yammy - 경제 뉴스 맛있게 먹기',
  description: '경제 뉴스를 AI로 번역하고 시장 영향을 분석해주는 스마트 큐레이션 서비스',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}