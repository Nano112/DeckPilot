import type { Toast } from "../hooks/useToast";

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

const COLORS: Record<Toast["type"], { bg: string; border: string }> = {
  success: { bg: "rgba(34, 197, 94, 0.15)", border: "#22c55e" },
  error: { bg: "rgba(239, 68, 68, 0.15)", border: "#ef4444" },
  info: { bg: "rgba(59, 130, 246, 0.15)", border: "#3b82f6" },
};

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="absolute bottom-4 inset-x-0 flex flex-col items-center gap-2 pointer-events-none z-50">
      {toasts.map((toast) => {
        const colors = COLORS[toast.type];
        return (
          <div
            key={toast.id}
            onClick={() => onDismiss(toast.id)}
            className="pointer-events-auto px-4 py-2 rounded-xl text-sm text-[var(--text-primary)] max-w-[90%] text-center border backdrop-blur-sm toast-enter"
            style={{
              backgroundColor: colors.bg,
              borderColor: colors.border,
            }}
          >
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}
