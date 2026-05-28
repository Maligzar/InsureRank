import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="px-4 py-6 md:px-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-6">Settings</h1>
      <div className="bg-slate-800 rounded-xl p-4 space-y-3">
        <div>
          <p className="text-xs text-slate-500">Name</p>
          <p className="text-sm font-medium text-white mt-0.5">{session.user.name}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Email</p>
          <p className="text-sm font-medium text-white mt-0.5">{session.user.email}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Role</p>
          <p className="text-sm font-medium text-white mt-0.5">{session.user.role}</p>
        </div>
      </div>
    </div>
  )
}
