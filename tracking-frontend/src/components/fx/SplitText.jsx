import { Fragment } from 'react';

// Kinetic headline: every letter rises out of its own mask in a staggered sequence (CSS in styles/fx.css). Words are
// kept whole so a headline never breaks mid-word; "\n" in the text is a deliberate line break. The visible letters
// are aria-hidden and the full text is the accessible name, so screen readers read a normal heading. `mark` names the
// one word to emphasise (styled by .is-mark: chartreuse type after dark, jet on a chartreuse block by day).
export default function SplitText({ text, as: Tag = 'span', className = '', delay = 0, mark }) {
  let index = 0;
  const lines = text.split('\n');
  return (
    <Tag className={`split ${className}`} aria-label={text.replace(/\n/g, ' ')} style={{ '--split-delay': `${delay}ms` }}>
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} className="split-line" aria-hidden="true">
          {line.split(' ').map((word, wordIndex, words) => (
            <Fragment key={wordIndex}>
              <span className={`split-word${mark && word.replace(/[^\p{L}\p{N}]/gu, '') === mark ? ' is-mark' : ''}`}>
                {[...word].map((char, charIndex) => (
                  <span key={charIndex} className="split-mask">
                    <span className="split-char" style={{ '--i': index++ }}>{char}</span>
                  </span>
                ))}
              </span>
              {wordIndex < words.length - 1 ? ' ' : null}
            </Fragment>
          ))}
        </span>
      ))}
    </Tag>
  );
}
