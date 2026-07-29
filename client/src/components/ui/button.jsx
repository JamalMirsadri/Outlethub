import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))] text-primary-foreground shadow-[0_18px_34px_hsl(var(--accent)/0.22)] hover:-translate-y-0.5 hover:brightness-[1.03]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-border bg-card/80 text-foreground shadow-[0_10px_25px_hsl(var(--foreground)/0.05)] hover:border-[hsl(var(--accent))/0.55] hover:bg-[hsl(var(--accent))/0.08]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[0_10px_24px_hsl(var(--foreground)/0.05)] hover:bg-secondary/88",
        ghost: "text-foreground hover:bg-[hsl(var(--accent))/0.09] hover:text-[hsl(var(--primary))]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2.5",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    (<Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />)
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
