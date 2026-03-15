import { useUIStore, Toast } from '../../stores/uiStore';
import { cn } from '../../lib/utils';

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none sm:bottom-6 sm:right-4 sm:left-auto sm:translate-x-0">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      className={cn(
        'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer',
        'backdrop-blur-glass border shadow-card animate-slide-up',
        'min-w-[240px] max-w-[360px]',
        toast.type === 'success' && 'bg-green-900/40 border-green-500/30 text-green-300',
        toast.type === 'error' && 'bg-red-900/40 border-red-500/30 text-red-300',
        toast.type === 'warning' && 'bg-orange-900/40 border-orange-500/30 text-orange-300',
        toast.type === 'info' && 'bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.12)] text-white',
      )}
    >
      <span className="text-base">
        {toast.type === 'success' && '✓'}
        {toast.type === 'error' && '✕'}
        {toast.type === 'warning' && '⚠'}
        {toast.type === 'info' && 'ℹ'}
      </span>
      <span className="text-sm font-medium flex-1">{toast.message}</span>
    </div>
  );
}
