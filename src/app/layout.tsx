import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'News Yammy AI - Economic News Intelligence',
  description: 'Your personal Korean economic news curator with AI-powered translations and market impact analysis',
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