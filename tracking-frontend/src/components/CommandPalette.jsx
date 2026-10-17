import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import Icon from './ui/Icon.jsx';
import { api } from '../lib/api.js';
import { isAdmin, useAuth } from '../lib/auth.jsx';
import { useRouter } from '../lib/router.jsx';
import { useSceneMode } from '../lib/sceneMode.js';
import { categoryColor, categoryLabel, matchesSearch } from '../lib/locationCategories.js';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MAX_PLACES = 8;

// Ctrl/Cmd+K quick switcher: pages for the signed-in role, real campus locations (non-admins) and a few
// actions. Only the modifier combo opens it, so plain typing in inputs is never intercepted.
export default function CommandPalette({ pages }) {
  const { user, logout } = useAuth();
  const { navigate } = useRouter();
  const [mode, toggleMode] = useSceneMode();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  // Every opening starts with an empty box. The reset happens while rendering (React's supported "reset state when a
  // value changes" pattern), not in the effect below, so the dialog's first frame never shows the previous query and
  // keystrokes arriving straight after Ctrl+K cannot land on it.
  const [shown, setShown] = useState(false);
  if (open !== shown) {
    setShown(open);
    if (open) {
      setText('');
      setActive(0);
    }
  }
  const [places, setPlaces] = useState({ state: 'idle', data: [], message: null });
  const placesRef = useRef(places);
  placesRef.current = places;
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();
  const admin = isAdmin(user);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Campus locations come from the API the first time the palette opens (retried on a later open if it failed).
  useEffect(() => {
    if (!open || admin || ['ready', 'loading'].includes(placesRef.current.state)) return;
    setPlaces((p) => ({ ...p, state: 'loading', message: null }));
    api.getCampusLocations().then(
      (data) => setPlaces({ state: 'ready', data, message: null }),
      (error) => setPlaces({ state: 'error', data: [], message: error.message }),
    );
  }, [open, admin]);

  const items = useMemo(() => {
    const query = text.trim().toLowerCase();
    const has = (value) => !query || value.toLowerCase().includes(query);
    const list = [];
    pages.filter((page) => has(page.label)).forEach((page) => list.push({
      id: `page:${page.to}`, group: 'Go to', icon: page.icon, label: page.label, run: () => navigate(page.to),
    }));
    places.data.filter((place) => matchesSearch(place, text)).slice(0, MAX_PLACES).forEach((place) => list.push({
      id: `place:${place.code}`,
      group: 'Campus locations',
      swatch: categoryColor(place.category),
      label: place.name,
      hint: `${categoryLabel(place.category)} · ${place.code}`,
      run: () => navigate(`/app/explore?location=${encodeURIComponent(place.code)}`),
    }));
    [
      {
        id: 'action:mode',
        icon: mode === 'day' ? 'moon' : 'sun',
        label: mode === 'day' ? 'Switch to dark theme' : 'Switch to light theme',
        keywords: 'theme day night light dark mode burgundy ivory scene',
        run: toggleMode,
      },
      { id: 'action:logout', icon: 'logout', label: 'Sign out', keywords: 'log out logout exit', run: logout },
    ].filter((action) => has(action.label) || (query && action.keywords.includes(query)))
      .forEach((action) => list.push({ ...action, group: 'Actions' }));
    return list;
  }, [text, pages, places.data, mode, toggleMode, logout, navigate]);

  const current = items.length ? Math.min(active, items.length - 1) : -1;
  const optionId = (index) => `${listId}-opt-${index}`;

  useEffect(() => {
    if (current >= 0) document.getElementById(optionId(current))?.scrollIntoView({ block: 'nearest' });
    // optionId is derived from listId, which is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const run = (item) => {
    setOpen(false);
    item.run();
  };

  const onInputKey = (event) => {
    if (!items.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current - 1 + items.length) % items.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(items[current]);
    }
  };

  return (
    <>
      <button type="button" className="cmdk-trigger" onClick={() => setOpen(true)} aria-keyshortcuts="Control+K Meta+K" aria-haspopup="dialog">
        <Icon name="search" size={16} />
        <span className="cmdk-trigger-label">{admin ? 'Jump to…' : 'Search campus…'}</span>
        <kbd aria-hidden="true">{IS_MAC ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <dialog
        ref={dialogRef}
        className="modal cmdk"
        aria-label="Command palette"
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
      >
        {open && (
          <div className="cmdk-body">
            <div className="cmdk-input">
              <Icon name="search" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={current >= 0 ? optionId(current) : undefined}
                aria-label="Search pages, places and actions"
                placeholder={admin ? 'Search pages and actions…' : 'Search places, pages and actions…'}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKey}
              />
              <kbd aria-hidden="true">Esc</kbd>
            </div>
            <ul id={listId} role="listbox" className="cmdk-list" aria-label="Results">
              {items.map((item, index) => (
                <Fragment key={item.id}>
                  {(index === 0 || items[index - 1].group !== item.group) && (
                    <li role="presentation" className="cmdk-group">{item.group}</li>
                  )}
                  <li
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === current}
                    className={`cmdk-item ${index === current ? 'active' : ''}`}
                    onMouseMove={() => index !== current && setActive(index)}
                    onClick={() => run(item)}
                  >
                    {item.swatch
                      ? <span className="swatch" style={{ background: item.swatch }} />
                      : <Icon name={item.icon} size={16} />}
                    <span className="cmdk-label">{item.label}</span>
                    {item.hint && <small>{item.hint}</small>}
                    {index === current && <Icon name="enter" size={14} className="cmdk-enter" />}
                  </li>
                </Fragment>
              ))}
            </ul>
            <p className="cmdk-status" aria-live="polite">
              {places.state === 'loading' && 'Loading campus locations…'}
              {places.state === 'error' && `Campus locations unavailable: ${places.message}`}
              {places.state !== 'loading' && items.length === 0 && `No results for “${text.trim()}”`}
            </p>
            <footer className="cmdk-foot" aria-hidden="true">
              <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
              <span><kbd>↵</kbd> open</span>
              <span><kbd>Esc</kbd> close</span>
            </footer>
          </div>
        )}
      </dialog>
    </>
  );
}
