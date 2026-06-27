"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error";

type ToastMessage = {
  id: number;
  type: ToastType;
  message: string;
};

let toastId = 0;
const listeners = new Set<(toast: ToastMessage) => void>();

export function showAuthToast(type: ToastType, message: string) {
  const toast: ToastMessage = { id: ++toastId, type, message };
  listeners.forEach((listener) => listener(toast));
}

export default function AuthToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    function onToast(toast: ToastMessage) {
      setToasts((current) => [...current, toast]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 4500);
    }

    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-6 z-50 flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.type === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg animate-auth-toast-in",
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800",
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="size-5 shrink-0" />
          ) : (
            <AlertCircle className="size-5 shrink-0" />
          )}
          <p className="flex-1 leading-snug">{toast.message}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
            className="shrink-0 opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
