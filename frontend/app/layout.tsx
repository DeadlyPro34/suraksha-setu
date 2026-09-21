import './globals.css'
export const metadata = { title: 'Suraksha Setu', description: 'Suraksha Setu Application' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>)
}
