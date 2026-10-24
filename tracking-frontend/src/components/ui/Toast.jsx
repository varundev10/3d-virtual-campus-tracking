import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Icon from './Icon.jsx';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((items) => items.filter((t) => t.id !== id)), []);

  // options: { duration (ms), action: { label, onClick } }. An action renders as a button under the message and
  // dismisses the toast once it has run.
  const push = useCallback((type, message, options = {}) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((items) => [...items.slice(-3), { id, type, message, action: options.action }]);
    window.setTimeout(() => dismiss(id), options.duration ?? (type === 'error' ? 7000 : 4000));
  }, [dismiss]);

  const value = useMemo(() => ({
    success: (message, options) => push('success', message, options),
    error: (message, options) => push('error', message, options),
    info: (message, options) => push('info', message, options),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
            <Icon name={toast.type === 'success' ? 'check' : toast.type === 'error' ? 'alert' : 'info'} />
            <div className="toast-body">
              <p>{toast.message}</p>
              {toast.action && (
                <button type="button" className="toast-action" onClick={() => { toast.action.onClick(); dismiss(toast.id); }}>
                  {toast.action.label}
                </button>
              )}
            </div>
            <button type="button" className="icon-button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
