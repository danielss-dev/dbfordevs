import * as React from "react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  ToastProgress,
} from "@/components/ui/toast"
import { useToast } from "@/hooks/useToast"
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, duration, ...props }) {
        const Icon = {
          success: CheckCircle2,
          destructive: AlertCircle,
          warning: AlertTriangle,
          default: Info,
        }[variant || "default"] || Info

        return (
          <Toast key={id} variant={variant} duration={duration} {...props}>
            <div className="flex gap-3">
              <Icon className={
                variant === "destructive" 
                  ? "h-5 w-5 shrink-0" 
                  : `h-5 w-5 shrink-0 ${
                      variant === "success" ? "text-success" : 
                      variant === "warning" ? "text-warning" : 
                      "text-primary"
                    }`
              } />
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
            <ToastProgress duration={duration || 3000} />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
