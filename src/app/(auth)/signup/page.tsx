'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z
  .object({
    orgName: z.string().min(2, 'Agency name must be at least 2 characters').max(100),
    orgSlug: z
      .string()
      .min(2, 'URL slug must be at least 2 characters')
      .max(50)
      .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

export default function SignupPage() {
  const router = useRouter()
  const params = useSearchParams()
  const inviteToken = params.get('invite')
  const [serverError, setServerError] = useState<string | null>(null)
  const [step, setStep] = useState(inviteToken ? 2 : 1)

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      const endpoint = inviteToken ? '/api/v1/invites/accept' : '/api/v1/auth/register'
      const body = inviteToken
        ? { token: inviteToken, name: data.name, password: data.password }
        : {
            orgName: data.orgName,
            orgSlug: data.orgSlug,
            name: data.name,
            email: data.email,
            password: data.password,
          }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const json = await res.json()
        setServerError(json.error ?? 'Registration failed')
        return
      }

      await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })
      router.push('/dashboard')
    } catch {
      setServerError('Something went wrong. Please try again.')
    }
  }

  async function goToStep2() {
    const valid = await trigger(['orgName', 'orgSlug'])
    if (valid) setStep(2)
  }

  return (
    <div className="bg-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-6">
        {!inviteToken && (
          <>
            <div
              className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-indigo-500' : 'bg-slate-600'}`}
            />
            <div
              className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-indigo-500' : 'bg-slate-600'}`}
            />
          </>
        )}
      </div>

      <h2 className="text-lg font-semibold text-white mb-6">
        {inviteToken
          ? 'Accept your invitation'
          : step === 1
            ? 'Set up your agency'
            : 'Create your account'}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {step === 1 && !inviteToken && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Agency name</label>
              <input
                {...register('orgName')}
                type="text"
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-white px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-500"
                placeholder="Apex Insurance Agency"
              />
              {errors.orgName && (
                <p className="mt-1 text-xs text-red-400">{errors.orgName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Agency URL slug
                <span className="ml-1 text-slate-500 font-normal text-xs">insurerank.com/</span>
              </label>
              <input
                {...register('orgSlug')}
                type="text"
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-white px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-500"
                placeholder="apex-insurance"
              />
              {errors.orgSlug && (
                <p className="mt-1 text-xs text-red-400">{errors.orgSlug.message}</p>
              )}
            </div>

            <button
              type="button"
              onClick={goToStep2}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-3 text-base transition-colors"
            >
              Continue
            </button>
          </>
        )}

        {(step === 2 || inviteToken) && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Your name</label>
              <input
                {...register('name')}
                type="text"
                autoComplete="name"
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-white px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-500"
                placeholder="Sarah Chen"
              />
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
            </div>

            {!inviteToken && (
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
                {errors.email && (
                  <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <input
                {...register('password')}
                type="password"
                autoComplete="new-password"
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-white px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Confirm password
              </label>
              <input
                {...register('confirmPassword')}
                type="password"
                autoComplete="new-password"
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-white px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>
              )}
            </div>

            {serverError && (
              <div className="rounded-lg bg-red-900/40 border border-red-700 px-3 py-2 text-sm text-red-300">
                {serverError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              {!inviteToken && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg py-3 text-base transition-colors"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-3 text-base transition-colors"
              >
                {isSubmitting ? 'Creating…' : inviteToken ? 'Accept & join' : 'Create account'}
              </button>
            </div>
          </>
        )}
      </form>

      {!inviteToken && (
        <p className="mt-5 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Sign in
          </Link>
        </p>
      )}
    </div>
  )
}
