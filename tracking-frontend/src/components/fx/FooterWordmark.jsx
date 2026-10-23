// The footer finale: the site's name set enormous across the full width, outlined, and filling with pink as it scrolls
// into view (data-reveal adds .is-in) or when you hover it. SVG text with textLength always spans exactly the width of
// its container, at any screen size. Decorative: the real name is the footer's accessible label.
export default function FooterWordmark({ word = 'UCER', caption = 'Smart Campus: a 3D virtual campus with opt-in location sharing' }) {
  const layer = (className) => (
    <svg className={className} viewBox="0 0 400 118" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <text x="0" y="110" textLength="400" lengthAdjust="spacingAndGlyphs">{word}</text>
    </svg>
  );
  return (
    <footer className="wordmark" data-reveal aria-label={`${word} Smart Campus`}>
      <p className="label wordmark-caption">{caption}</p>
      <div className="wordmark-art">
        {layer('wordmark-outline')}
        {layer('wordmark-fill')}
      </div>
    </footer>
  );
}
