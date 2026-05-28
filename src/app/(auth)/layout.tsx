import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">InsureRank</h1>
          <p className="text-slate-400 text-sm mt-1">Insurance sales, ranked.</p>
        </div>
        {children}
      </div>
    </div>
  )
}
