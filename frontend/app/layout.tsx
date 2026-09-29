import './globals.css'
import { Metadata } from 'next'
import { Bricolage_Grotesque, Hind } from 'next/font/google'

const display = Bricolage_Grotesque({ subsets: ['latin'], display: 'swap', variable: '--font-display' })
const body = Hind({ subsets: ['latin', 'devanagari'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-body' })

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
      <body className={`${display.variable} ${body.variable} font-sans min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  )
}
