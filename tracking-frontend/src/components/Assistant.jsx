import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './ui/Icon.jsx';
import { api } from '../lib/api.js';
import { Link } from '../lib/router.jsx';

let nextId = 1;
const message = (role, text, extra = {}) => ({ id: nextId++, role, text, ...extra });

// Floating campus assistant. It asks the server, which answers from the signed-in user's own role-scoped data, so
// nothing here knows about attendance or alerts: it only sends text and shows the reply.
export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  const ask = useCallback(async (question, { silent = false } = {}) => {
    const q = question.trim();
    if (!q) return;
    if (!silent) setMessages((items) => [...items, message('user', q)]);
    setText('');
    setSuggestions([]);
    setBusy(true);
    try {
      const reply = await api.askAssistant(q);
      setMessages((items) => [...items, message('bot', reply.reply, { link: reply.link, linkLabel: reply.linkLabel })]);
      setSuggestions(reply.suggestions ?? []);
    } catch (error) {
      setMessages((items) => [...items, message('bot', `Sorry, I could not answer that. ${error.message}`, { error: true })]);
    } finally {
      setBusy(false);
    }
  }, []);

  // The first opening greets the user; the server's reply to "help" is role-specific.
  useEffect(() => {
    if (open && !started.current) {
      started.current = true;
      ask('help', { silent: true });
    }
    if (open) inputRef.current?.focus();
  }, [open, ask]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const submit = (event) => {
    event.preventDefault();
    if (!busy) ask(text);
  };

  return (
    <div className="assistant">
      {open && (
        <section className="assistant-panel" role="dialog" aria-label="Campus assistant" ref={panelRef}>
          <header className="assistant-head">
            <span className="assistant-badge" aria-hidden="true"><Icon name="spark" size={18} /></span>
            <div>
              <strong>Campus assistant</strong>
              <small>Answers from your own campus data</small>
            </div>
            <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Close assistant">
              <Icon name="close" size={18} />
            </button>
          </header>

          <div className="assistant-log" ref={listRef} aria-live="polite" aria-relevant="additions">
            {messages.map((m) => (
              <div key={m.id} className={`bubble bubble-${m.role} ${m.error ? 'is-error' : ''}`}>
                <p>{m.text}</p>
                {m.link && <Link to={m.link} className="bubble-link" onClick={() => setOpen(false)}>{m.linkLabel ?? 'Open'} <Icon name="external" size={14} /></Link>}
              </div>
            ))}
            {busy && (
              <div className="bubble bubble-bot is-typing" role="status" aria-label="Assistant is typing">
                <span /><span /><span />
              </div>
            )}
          </div>

          {suggestions.length > 0 && (
            <div className="assistant-suggestions" role="group" aria-label="Suggested questions">
              {suggestions.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => ask(s)} disabled={busy}>{s}</button>
              ))}
            </div>
          )}

          <form className="assistant-form" onSubmit={submit}>
            <input
              ref={inputRef}
              className="input"
              value={text}
              maxLength={300}
              placeholder="Ask about classes, attendance, alerts…"
              aria-label="Ask the campus assistant"
              autoComplete="off"
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()} aria-label="Send">
              <Icon name="send" size={18} />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className={`assistant-launcher ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close campus assistant' : 'Open campus assistant'}
      >
        <Icon name={open ? 'close' : 'chat'} size={24} />
      </button>
    </div>
  );
}
