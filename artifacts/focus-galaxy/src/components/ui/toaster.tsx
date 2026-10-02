import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} className="focus-toast" duration={4600}>
            <div className="grid gap-1">
              {title && <ToastTitle className="focus-toast-title">{title}</ToastTitle>}
              {description && (
                <ToastDescription className="focus-toast-description">{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport className="focus-toast-viewport" />
    </ToastProvider>
  );
}
