import Icon from './ui/Icon.jsx';

const STATE_LABEL = {
  active: 'Loading',
  done: 'Ready',
  failed: 'Unavailable',
  skipped: 'Not used',
};

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

// Presentation only: every value comes from useCampusIntro, which derives it from real loading state.
// Skip is part of the very first render and stays reachable by keyboard (Tab or Esc) in every phase.
export default function CinematicIntro({ phase, steps, percent, slow, onSkip, onEnter }) {
  const announce = phase === 'loading'
    ? `Loading the campus: ${Math.floor(percent / 25) * 25} percent`
    : phase === 'ready' ? 'The campus is ready. Choose Enter Campus to begin.' : 'Campus digital twin';

  return (
    <section className="cine" data-phase={phase} aria-label="Campus introduction">
      <div className="cine-backdrop" aria-hidden="true" />

      {phase === 'loading' && (
        <div className="cine-loading">
          <p className="cine-eyebrow">Preparing your campus</p>
          <div
            className="cine-bar"
            role="progressbar"
            aria-label="Loading the campus"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <span style={{ transform: `scaleX(${percent / 100})` }} />
          </div>
          <p className="cine-percent">{percent}%</p>
          <ul className="cine-steps">
            {steps.map((step) => (
              <li key={step.id} data-state={step.state}>
                <span className="cine-step-mark" aria-hidden="true">
                  {step.state === 'done' && <Icon name="check" size={14} />}
                  {step.state === 'failed' && <Icon name="alert" size={14} />}
                  {step.state === 'skipped' && <Icon name="minus" size={14} />}
                </span>
                <span className="cine-step-label">{step.label}</span>
                <span className="cine-step-state">
                  {STATE_LABEL[step.state]}{step.detail ? ` · ${step.detail}` : ''}
                </span>
              </li>
            ))}
          </ul>
          {slow && <p className="cine-slow">Still loading. You can skip the intro and start exploring right away.</p>}
        </div>
      )}

      {(phase === 'title' || phase === 'reveal') && (
        <h2 className="cine-title">
          <span className="cine-title-main">CAMPUS</span>
          <span className="cine-title-sub">DIGITAL TWIN</span>
        </h2>
      )}

      {phase === 'ready' && (
        <div className="cine-ready">
          <h2>Explore your campus</h2>
          <p>
            Drag to orbit, scroll or pinch to zoom. Press <kbd>{IS_MAC ? '⌘' : 'Ctrl'} K</kbd> to find a place.
          </p>
          <button type="button" className="btn btn-primary cine-enter" onClick={onEnter} autoFocus>
            Enter Campus <Icon name="enter" size={16} />
          </button>
        </div>
      )}

      {phase !== 'ready' && (
        <button type="button" className="btn btn-secondary btn-sm cine-skip" onClick={onSkip} autoFocus={phase === 'loading'}>
          Skip intro <kbd aria-hidden="true">Esc</kbd>
        </button>
      )}

      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
    </section>
  );
}
