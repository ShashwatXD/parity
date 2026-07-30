import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  icon?: boolean;
  children?: ReactNode;
};

const variantClass: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

export function Button({
  variant = 'secondary',
  icon = false,
  className,
  children,
  ...rest
}: Props) {
  return (
    <button className={cn('btn', variantClass[variant], icon && 'btn-icon', className)} {...rest}>
      {children}
    </button>
  );
}
