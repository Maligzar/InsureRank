'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({ email: z.string().email('Enter a valid email') })
type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        setServerError('Something went wrong. Please try again.')
        return
      }
      setSent(true)
    } catch {
      setServerError('Something went wrong. Please try again.')
    }
  }

  if (sent) {
    return (
      <div className="bg-slate-800 rounded-2xl p-6 shadow-xl text-center">
        <div className="w-12 h-12 rounded-full bg-indigo-600/20 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-indigo-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">Check your email</h2>
        <p className="text-slate-400 text-sm mb-5">
          If that address is in our system, we&apos;ve sent a reset link. It expires in 1 hour.
        </p>
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-2xl p-6 shadow-xl">
      <h2 className="text-lg font-semibold text-white mb-2">Reset your password</h2>
      <p className="text-slate-400 text-sm mb-6">
        Enter your email and we&apos;ll send you a reset link.
      </p>

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
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-400">
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
