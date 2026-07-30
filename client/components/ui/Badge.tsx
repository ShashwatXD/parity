import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type Tone = 'default' | 'success' | 'error' | 'accent';

const toneClass: Record<Tone, string> = {
  default: '',
  success: 'badge-success',
  error: 'badge-error',
  accent: 'badge-accent',
};

export function Badge({
  children,
  tone = 'default',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return <span className={cn('badge', toneClass[tone], className)}>{children}</span>;
}
