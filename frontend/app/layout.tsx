import './globals.css'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Suraksha Setu — Disaster Response AI',
  description: 'AI-powered disaster response coordination system for real-time flood analysis, shelter management, and emergency resource allocation.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  )
}
