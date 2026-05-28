'use client'

import { useState, useRef } from 'react'

interface ImportResult {
  imported: number
  skipped: number
  parseErrors: Array<{ row: number; message: string }>
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/v1/imports/contacts', { method: 'POST', body: form })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Import failed')
      } else {
        setResult(json as ImportResult)
        setFile(null)
        if (inputRef.current) inputRef.current.value = ''
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Import Contacts</h1>

      <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700">CSV format requirements</p>
        <p className="mt-1">
          Required columns: <code className="rounded bg-slate-200 px-1">firstName</code>,{' '}
          <code className="rounded bg-slate-200 px-1">lastName</code>
        </p>
        <p className="mt-1">
          Optional: <code className="rounded bg-slate-200 px-1">email</code>,{' '}
          <code className="rounded bg-slate-200 px-1">phone</code>,{' '}
          <code className="rounded bg-slate-200 px-1">sourceChannel</code>,{' '}
          <code className="rounded bg-slate-200 px-1">lineOfBusiness</code>,{' '}
          <code className="rounded bg-slate-200 px-1">expectedRevenue</code>
        </p>
        <p className="mt-1 text-xs text-slate-500">Max 1,000 rows · Max 5 MB</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="csv-file" className="block text-sm font-medium text-slate-700">
            CSV file
          </label>
          <input
            id="csv-file"
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-indigo-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>

        <button
          type="submit"
          disabled={!file || loading}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Importing…' : 'Import Contacts'}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="rounded-md border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">
              Import complete — {result.imported} contacts imported
              {result.skipped > 0 && `, ${result.skipped} rows skipped`}
            </p>
          </div>

          {result.parseErrors.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 text-sm font-medium text-amber-800">
                {result.parseErrors.length} row{result.parseErrors.length !== 1 ? 's' : ''} had
                errors:
              </p>
              <ul className="space-y-1">
                {result.parseErrors.slice(0, 20).map(({ row, message }) => (
                  <li key={row} className="text-xs text-amber-700">
                    Row {row}: {message}
                  </li>
                ))}
                {result.parseErrors.length > 20 && (
                  <li className="text-xs text-amber-500">
                    …and {result.parseErrors.length - 20} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
