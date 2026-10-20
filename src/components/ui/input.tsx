import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-[52px] w-full min-w-0 rounded-lg border border-field bg-card px-4 text-base text-foreground transition-[border-color,box-shadow] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-focus disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-bad-bg",
        className
      )}
      {...props}
    />
  )
}

export { Input }
