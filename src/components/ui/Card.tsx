import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-gray-100 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function CardHeader({
  title,
  description,
  icon,
  action,
}: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-gray-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
