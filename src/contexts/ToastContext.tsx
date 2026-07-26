import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-center gap-2 sm:left-auto sm:right-5 sm:w-[24rem]"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => {
          const Icon = toast.tone === 'success'
            ? CheckCircle2
            : toast.tone === 'error'
              ? AlertCircle
              : Info;

          return (
            <div
              key={toast.id}
              className={[
                'pointer-events-auto flex w-full items-start gap-3 rounded-lg border bg-surface-container-lowest p-4 text-on-surface shadow-ambient-lg',
                toast.tone === 'error'
                  ? 'border-red-400/50'
                  : toast.tone === 'success'
                    ? 'border-emerald-500/40'
                    : 'border-outline-variant',
              ].join(' ')}
              role={toast.tone === 'error' ? 'alert' : 'status'}
            >
              <Icon
                size={20}
                className={
                  toast.tone === 'error'
                    ? 'text-red-600'
                    : toast.tone === 'success'
                      ? 'text-emerald-600'
                      : 'text-primary'
                }
              />
              <p className="min-w-0 flex-1 text-body-md">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
                aria-label="Fermer le message"
              >
                <X size={17} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast doit être utilisé dans ToastProvider');
  }

  return context;
}
