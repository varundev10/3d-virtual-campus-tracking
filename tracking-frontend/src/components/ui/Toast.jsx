import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Icon from './Icon.jsx';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((items) => items.filter((t) => t.id !== id)), []);

  const push = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((items) => [...items.slice(-3), { id, type, message }]);
    window.setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4000);
  }, [dismiss]);

  const value = useMemo(() => ({
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    info: (message) => push('info', message),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
            <Icon name={toast.type === 'success' ? 'check' : toast.type === 'error' ? 'alert' : 'info'} />
            <p>{toast.message}</p>
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
