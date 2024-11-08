"use client"

import * as React from "react"
import { X } from "lucide-react"

interface ToastProps {
  title?: string
  description?: string
  onClose?: () => void
}

export function Toast({ 
  title, 
  description, 
  onClose 
}: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.()
    }, 3000)

    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="bg-gray-800 text-white rounded-lg shadow-lg p-4 min-w-[200px] max-w-[350px]">
        <div className="flex justify-between items-start">
          {title && (
            <div className="font-semibold">{title}</div>
          )}
          <button 
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        {description && (
          <div className="mt-1 text-sm text-gray-300">{description}</div>
        )}
      </div>
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = React.useState<ToastProps | null>(null)

  const show = React.useCallback((props: ToastProps) => {
    setToast(props)
  }, [])

  const hide = React.useCallback(() => {
    setToast(null)
  }, [])

  return {
    toast,
    showToast: show,
    hideToast: hide,
  }
}
