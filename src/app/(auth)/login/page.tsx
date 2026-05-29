'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') ?? '/dashboard'
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    })
    if (result?.error) {
      setServerError('Invalid email or password')
      return
    }
    router.push(callbackUrl)
  }

  return (
    <div className="bg-slate-800 rounded-2xl p-6 shadow-xl">
      <h2 className="text-lg font-semibold text-white mb-6">Sign in to your account</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            inputMode="email"
            className="w-full rounded-lg bg-slate-700 border border-slate-600 text-white px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-500"
            placeholder="you@agency.com"
          />
          {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-slate-300">Password</label>
            <Link href="/forgot-password" className="text-xs text-indigo-400 hover:text-indigo-300">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 text-white px-3 py-3 pr-10 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
          )}
        </div>

        {serverError && (
          <div className="rounded-lg bg-red-900/40 border border-red-700 px-3 py-2 text-sm text-red-300">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-3 text-base transition-colors"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-400">
        New agency?{' '}
        <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium">
          Create an account
        </Link>
      </p>
    </div>
  )
}
