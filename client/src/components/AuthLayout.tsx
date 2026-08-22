import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface AuthLayoutProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  back?: ReactNode;
  children: ReactNode;
}

export default function AuthLayout({
  icon: Icon,
  title,
  subtitle,
  footer,
  back,
  children,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,hsl(var(--accent)/0.15),transparent_46%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
      <div className="w-full max-w-md">
        {back && <div className="mb-6">{back}</div>}
        <div className="text-center mb-10">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-primary shadow-[0_12px_24px_hsl(var(--foreground)/0.12)]">
            <Icon className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-[-0.04em] text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="rounded-[28px] border border-border/70 bg-card/90 p-8 shadow-[0_22px_60px_hsl(var(--foreground)/0.08)]">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
      </div>
    </div>
  );
}
