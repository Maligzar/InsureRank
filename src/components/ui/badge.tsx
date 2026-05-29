import { cn } from '@/lib/utils'

type Variant = 'default' | 'hot' | 'warm' | 'cold' | 'success' | 'warning' | 'danger' | 'outline'

const variants: Record<Variant, string> = {
  default: 'bg-slate-700 text-slate-300',
  hot: 'bg-red-900/40 text-red-300 border border-red-700',
  warm: 'bg-amber-900/40 text-amber-300 border border-amber-700',
  cold: 'bg-blue-900/40 text-blue-300 border border-blue-700',
  success: 'bg-green-900/40 text-green-300 border border-green-700',
  warning: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700',
  danger: 'bg-red-900/40 text-red-300 border border-red-700',
  outline: 'border border-slate-600 text-slate-400',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: Variant
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
