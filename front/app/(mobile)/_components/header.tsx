import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Home, Menu } from 'lucide-react'
import Link from 'next/link'

export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-999 bg-amber-700 border-b border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">ThinkLocation</h1>

        <Sheet>
          <SheetTrigger className="md:hidden">
            <Menu className="w-6 h-6" />
          </SheetTrigger>
          <SheetContent className="z-9999 p-4 py-6">
            <SheetTitle>Menu de navegação</SheetTitle>
            <nav className="mt-4">
              <Link href="/" className="flex items-center gap-2">
                <Home className="w-6 h-6 text-slate-900" />
                <span>Home</span>
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
