// File Path: src/app/layout.js
import '../global.css' // Path confirmed correct by ls -R
import { Inter } from 'next/font/google'
import { AppProvider } from '@/context/AppContext.jsx' // Added .jsx for consistency

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Scientific Paper Structure Checker',
  description: 'Analyze and improve the structure of your scientific papers',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppProvider>
          <div className="min-h-screen flex flex-col">
            <header className="py-4 border-b">
              <div className="container">
                <h1 className="text-2xl font-bold">Scientific Paper Structure Checker</h1>
              </div>
            </header>
            <main className="flex-1 container py-8">
              {children}
            </main>
            <footer className="py-4 border-t">
              <div className="container text-center text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} Scientific Paper Structure Checker
              </div>
            </footer>
          </div>
        </AppProvider>
      </body>
    </html>
  )
}
