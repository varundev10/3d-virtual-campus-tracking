import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Minimal history-API router; the app only needs a handful of static routes.
const RouterContext = createContext(null);

function readLocation() {
  return { path: window.location.pathname, search: window.location.search };
}

export function RouterProvider({ children }) {
  const [location, setLocation] = useState(readLocation);

  useEffect(() => {
    const handlePop = () => setLocation(readLocation());
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    const current = window.location.pathname + window.location.search;
    if (to !== current) {
      window.history[replace ? 'replaceState' : 'pushState'](null, '', to);
    }
    setLocation(readLocation());
    if (!replace) window.scrollTo(0, 0);
  }, []);

  const value = useMemo(() => ({
    path: location.path,
    query: new URLSearchParams(location.search),
    navigate,
  }), [location, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  return useContext(RouterContext);
}

export function Link({ to, children, onClick, ...props }) {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        navigate(to);
      }}
      {...props}
    >
      {children}
    </a>
  );
}

export function Redirect({ to }) {
  const { navigate } = useRouter();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);
  return null;
}
