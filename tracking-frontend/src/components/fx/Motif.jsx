// The signature motif: an eight-point asterisk, "the ping". Four crossing strokes, so at small sizes it reads as a survey
// crosshair and at large sizes as a festival star. The same path is the favicon (index.html) and the --motif CSS mask
// (styles/fx.css), so every appearance of the brand mark is one shape.
export default function Motif({ size = 16, spin = false, className = '', label }) {
  return (
    <svg
      className={`motif${spin ? ' motif-spin' : ''}${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
    >
      <path d="M12 2.5v19M2.5 12h19M5.3 5.3l13.4 13.4M18.7 5.3 5.3 18.7" />
    </svg>
  );
}
