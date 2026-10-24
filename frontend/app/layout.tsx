import './globals.css'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Suraksha Setu — Disaster Response AI',
  description: 'AI-powered disaster response coordination for real-time flood analysis, shelter management, and emergency resource allocation.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="font-sans min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
