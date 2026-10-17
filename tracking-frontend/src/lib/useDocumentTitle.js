import { useEffect } from 'react';

const SITE = 'UCER Smart Campus';

// Keeps the browser tab, history entries and screen readers' page announcements in step with the view. Every route
// is a different page in a single-page app, and the title is how people tell them apart.
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : SITE;
  }, [title]);
}
