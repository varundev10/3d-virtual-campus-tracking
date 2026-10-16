// Labelled form controls with inline error text wired up via aria-describedby.
export function Field({ id, label, error, hint, children }) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && !error && <small id={`${id}-hint`} className="field-hint">{hint}</small>}
      {error && <small id={`${id}-error`} className="field-error">{error}</small>}
    </div>
  );
}

export function TextField({ id, label, error, hint, ...inputProps }) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      {(a11y) => <input className="input" {...a11y} {...inputProps} />}
    </Field>
  );
}

export function SelectField({ id, label, error, hint, children, ...selectProps }) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      {(a11y) => <select className="input" {...a11y} {...selectProps}>{children}</select>}
    </Field>
  );
}
