const { useState, useEffect, useMemo, useRef } = React;

const STORAGE_KEY = 'poll_responses_v1';
const OPTIONS = [
  { id: 'amazing', emoji: '🤩', label: 'Génial !', sub: "J'ai adoré", color: 'amazing' },
  { id: 'meh',     emoji: '😐', label: 'Bof',         sub: "Mouais...",    color: 'meh' },
  { id: 'useless', emoji: '😴', label: 'Inutile',     sub: "Perte de temps", color: 'useless' },
];

// ---------- storage helpers ----------
const loadResponses = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
};
const saveResponse = (choice) => {
  const all = loadResponses();
  all.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), choice, ts: Date.now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return all;
};
const clearResponses = () => { localStorage.removeItem(STORAGE_KEY); };

// ---------- tweak protocol ----------
function useTweaks() {
  const [t, setT] = useState(window.__TWEAKS);
  useEffect(() => {
    const handler = (e) => {
      if (!e.data) return;
      if (e.data.type === '__activate_edit_mode') setT(prev => ({ ...prev, __editMode: true }));
      if (e.data.type === '__deactivate_edit_mode') setT(prev => ({ ...prev, __editMode: false }));
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);
  const update = (key, val) => {
    setT(prev => ({ ...prev, [key]: val }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: val } }, '*');
  };
  return [t, update];
}

// ---------- Main app ----------
function App() {
  const [tweaks, setTweak] = useTweaks();
  const [view, setView] = useState('poll'); // poll | thanks | admin
  const [chosen, setChosen] = useState(null);
  const [responses, setResponses] = useState(loadResponses());
  const [justVoted, setJustVoted] = useState(false);

  // re-read on focus (if admin clears in another tab)
  useEffect(() => {
    const onFocus = () => setResponses(loadResponses());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Apply theme
  useEffect(() => {
    const themeMap = { sunny: '', neon: 'neon', pastel: 'pastel' };
    document.documentElement.setAttribute('data-theme', themeMap[tweaks.theme] || '');
  }, [tweaks.theme]);

  const submit = (choice) => {
    setChosen(choice);
    const all = saveResponse(choice);
    setResponses(all);
    setJustVoted(true);
    setTimeout(() => setView('thanks'), 650);
  };

  const resetAll = () => {
    if (!confirm('Supprimer toutes les réponses ?')) return;
    clearResponses();
    setResponses([]);
  };

  const goHome = () => {
    setView('poll');
    setChosen(null);
    setJustVoted(false);
  };

  // Hidden admin toggle: press "A" to toggle admin
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setView(v => v === 'admin' ? 'poll' : 'admin');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopBar view={view} setView={setView} count={responses.length} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px 80px' }}>
        {view === 'poll' && (
          <PollView
            onSubmit={submit}
            chosen={chosen}
            justVoted={justVoted}
            tweaks={tweaks}
          />
        )}
        {view === 'thanks' && (
          <ThanksView
            chosen={chosen}
            responses={responses}
            onRestart={goHome}
          />
        )}
        {view === 'admin' && (
          <AdminView responses={responses} onReset={resetAll} onBack={goHome} />
        )}
      </div>
      {tweaks.__editMode && <TweaksPanel tweaks={tweaks} setTweak={setTweak} />}
    </div>
  );
}

// ---------- Top bar ----------
function TopBar({ view, setView, count }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '18px 28px', borderBottom: '1.5px solid var(--line)',
      background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 800, fontSize: 15,
          border: '1.5px solid var(--line)',
          boxShadow: '2px 2px 0 var(--line)',
        }}>✦</div>
        <span className="display" style={{ fontSize: 18 }}>FeedbackFlash</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setView('poll')}
          className="mono"
          style={pillStyle(view === 'poll')}
        >Sondage</button>
        <button
          onClick={() => setView('admin')}
          className="mono"
          style={pillStyle(view === 'admin')}
        >Admin · {count}</button>
      </div>
    </div>
  );
}

function pillStyle(active) {
  return {
    fontFamily: 'inherit',
    fontSize: 12,
    padding: '8px 14px',
    borderRadius: 999,
    border: '1.5px solid var(--line)',
    background: active ? 'var(--ink)' : 'transparent',
    color: active ? 'var(--bg)' : 'var(--ink)',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 500,
  };
}

// ---------- Poll View ----------
function PollView({ onSubmit, chosen, justVoted, tweaks }) {
  return (
    <div style={{ maxWidth: 920, width: '100%', textAlign: 'center' }} data-screen-label="01 Sondage">
      <div className="mono" style={{
        display: 'inline-block',
        padding: '6px 12px',
        background: 'var(--accent)',
        color: 'white',
        borderRadius: 999,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        marginBottom: 24,
        border: '1.5px solid var(--line)',
        boxShadow: '2px 2px 0 var(--line)',
        transform: 'rotate(-1deg)',
      }}>
        Feedback en direct
      </div>

      <h1 className="display" style={{
        fontSize: 'clamp(38px, 6vw, 72px)',
        margin: '0 0 12px',
        lineHeight: 1.02,
      }}>
        Qu'avez-vous pensé<br />de cette présentation ?
      </h1>
      <p style={{
        fontSize: 17, color: 'var(--ink-soft)',
        margin: '0 auto 44px', maxWidth: 520, lineHeight: 1.5,
      }}>
        Un seul clic. Anonyme. Votre retour nous aide à nous améliorer.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: tweaks.layout === 'stack' ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 18,
        maxWidth: tweaks.layout === 'stack' ? 460 : 900,
        margin: '0 auto',
      }}>
        {OPTIONS.map((opt, i) => (
          <OptionCard
            key={opt.id}
            option={opt}
            index={i}
            selected={chosen === opt.id}
            dimmed={justVoted && chosen !== opt.id}
            onClick={() => !justVoted && onSubmit(opt.id)}
            buttonStyle={tweaks.buttonStyle}
          />
        ))}
      </div>

      <div className="mono" style={{ marginTop: 48, fontSize: 11, color: 'var(--ink-soft)', letterSpacing: '0.08em' }}>
        ✓ 100% ANONYME  ·  ✓ STOCKÉ LOCALEMENT  ·  ⌘A POUR ADMIN
      </div>
    </div>
  );
}

function OptionCard({ option, index, selected, dimmed, onClick, buttonStyle }) {
  const [hover, setHover] = useState(false);
  const rotations = [-1.5, 0, 1.5];
  const rot = rotations[index] || 0;

  const bg = `var(--${option.color})`;
  const ink = `var(--${option.color}-ink)`;

  const chunky = buttonStyle !== 'flat';

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={dimmed}
      style={{
        background: bg,
        color: ink,
        border: chunky ? '2px solid var(--line)' : 'none',
        borderRadius: 20,
        padding: '32px 20px 26px',
        fontFamily: 'inherit',
        cursor: dimmed ? 'default' : 'pointer',
        textAlign: 'center',
        opacity: dimmed ? 0.35 : 1,
        transform: `rotate(${hover && !dimmed ? 0 : rot}deg) translateY(${hover && !dimmed ? -6 : 0}px) scale(${selected ? 1.04 : 1})`,
        boxShadow: chunky
          ? (hover && !dimmed ? '8px 10px 0 var(--line)' : '4px 5px 0 var(--line)')
          : '0 8px 24px rgba(0,0,0,0.08)',
        transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        outline: selected ? '3px solid var(--ink)' : 'none',
        outlineOffset: 4,
      }}
    >
      <div style={{
        fontSize: 72,
        lineHeight: 1,
        marginBottom: 14,
        display: 'inline-block',
        transition: 'transform 0.3s',
        transform: hover && !dimmed ? 'scale(1.15) rotate(-8deg)' : 'scale(1)',
      }}>{option.emoji}</div>
      <div className="display" style={{ fontSize: 26, marginBottom: 4 }}>{option.label}</div>
      <div className="mono" style={{ fontSize: 12, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {option.sub}
      </div>
    </button>
  );
}

// ---------- Thanks View (live stats) ----------
function ThanksView({ chosen, responses, onRestart }) {
  const chosenOpt = OPTIONS.find(o => o.id === chosen);
  const stats = useMemo(() => computeStats(responses), [responses]);
  const total = responses.length;

  return (
    <div style={{ maxWidth: 720, width: '100%' }} data-screen-label="02 Merci">
      <div style={{
        background: 'var(--card)',
        border: '2px solid var(--line)',
        borderRadius: 24,
        padding: '40px 36px',
        boxShadow: '6px 8px 0 var(--line)',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 96, lineHeight: 1, marginBottom: 8,
          animation: 'pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'inline-block',
        }}>{chosenOpt?.emoji}</div>
        <h1 className="display" style={{ fontSize: 44, margin: '8px 0 6px' }}>
          Merci !
        </h1>
        <p style={{ color: 'var(--ink-soft)', margin: '0 0 28px', fontSize: 16 }}>
          Votre réponse <strong style={{ color: 'var(--ink)' }}>« {chosenOpt?.label} »</strong> a bien été enregistrée.
        </p>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 14, paddingBottom: 10, borderBottom: '1.5px dashed var(--line)',
        }}>
          <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-soft)' }}>
            Résultats en direct
          </span>
          <span className="mono" style={{ fontSize: 13 }}>
            <strong>{total}</strong> réponse{total > 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {OPTIONS.map(opt => {
            const s = stats[opt.id];
            const isMine = opt.id === chosen;
            return (
              <StatRow key={opt.id} option={opt} stat={s} highlight={isMine} total={total} />
            );
          })}
        </div>

        <button
          onClick={onRestart}
          className="mono"
          style={{
            marginTop: 32,
            padding: '12px 22px',
            border: '1.5px solid var(--line)',
            background: 'var(--ink)',
            color: 'var(--bg)',
            borderRadius: 999,
            fontFamily: 'inherit',
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            cursor: 'pointer',
            boxShadow: '3px 3px 0 var(--line)',
          }}
        >Envoyer une nouvelle réponse →</button>
      </div>

      <style>{`
        @keyframes pop {
          0% { transform: scale(0) rotate(-20deg); }
          60% { transform: scale(1.25) rotate(5deg); }
          100% { transform: scale(1) rotate(0); }
        }
        @keyframes fillBar {
          from { width: 0; }
        }
      `}</style>
    </div>
  );
}

function StatRow({ option, stat, highlight, total }) {
  const pct = total > 0 ? Math.round((stat.count / total) * 100) : 0;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '44px 1fr auto',
      alignItems: 'center',
      gap: 14,
      padding: '10px 14px',
      background: highlight ? `var(--${option.color})` : 'transparent',
      border: highlight ? '2px solid var(--line)' : '1.5px solid transparent',
      borderRadius: 14,
      transition: 'all 0.3s',
    }}>
      <div style={{ fontSize: 28, textAlign: 'center' }}>{option.emoji}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
          <span style={{ fontWeight: 600, color: highlight ? `var(--${option.color}-ink)` : 'var(--ink)' }}>
            {option.label}
          </span>
          <span className="mono" style={{ fontSize: 12, color: highlight ? `var(--${option.color}-ink)` : 'var(--ink-soft)' }}>
            {stat.count}
          </span>
        </div>
        <div style={{
          height: 10,
          borderRadius: 999,
          background: highlight ? 'rgba(0,0,0,0.15)' : 'var(--bg)',
          border: '1.5px solid var(--line)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            background: `var(--${option.color})`,
            borderRight: pct > 0 && pct < 100 ? '1.5px solid var(--line)' : 'none',
            transition: 'width 0.8s cubic-bezier(0.34, 1.3, 0.64, 1)',
            animation: 'fillBar 0.9s ease-out',
          }} />
        </div>
      </div>
      <div className="mono" style={{
        fontSize: 16, fontWeight: 500, minWidth: 44, textAlign: 'right',
        color: highlight ? `var(--${option.color}-ink)` : 'var(--ink)',
      }}>
        {pct}%
      </div>
    </div>
  );
}

// ---------- Admin View ----------
function AdminView({ responses, onReset, onBack }) {
  const stats = useMemo(() => computeStats(responses), [responses]);
  const total = responses.length;
  const nps = total > 0 ? Math.round(((stats.amazing.count - stats.useless.count) / total) * 100) : 0;
  const timeline = useMemo(() => computeTimeline(responses), [responses]);

  const exportCSV = () => {
    const rows = [['id', 'timestamp_iso', 'choice']];
    responses.forEach(r => {
      rows.push([r.id, new Date(r.ts).toISOString(), r.choice]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sondage-reponses-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: 1100, width: '100%' }} data-screen-label="03 Admin">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-soft)', marginBottom: 6 }}>
            Tableau de bord
          </div>
          <h1 className="display" style={{ fontSize: 40, margin: 0 }}>Résultats du sondage</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportCSV} className="mono" style={adminBtn()}>↓ Exporter CSV</button>
          <button onClick={onReset} className="mono" style={{ ...adminBtn(), background: 'var(--useless)', color: 'var(--useless-ink)' }}>✕ Tout effacer</button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <KPI label="Total réponses" value={total} sub={total === 0 ? 'Aucune réponse' : total === 1 ? '1 personne' : `${total} personnes`} />
        <KPI label="Satisfaction" value={total > 0 ? `${Math.round(stats.amazing.count / total * 100)}%` : '—'} sub="ont trouvé ça génial" color="amazing" />
        <KPI label="Score net" value={total > 0 ? (nps > 0 ? `+${nps}` : `${nps}`) : '—'} sub="géniaux − inutiles" color={nps >= 0 ? 'amazing' : 'useless'} />
        <KPI label="Dernière réponse" value={total > 0 ? timeAgo(responses[responses.length - 1].ts) : '—'} sub={total > 0 ? new Date(responses[responses.length - 1].ts).toLocaleString('fr-FR') : ''} />
      </div>

      {/* Two-column: bar chart + timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
        <BarChart stats={stats} total={total} />
        <Timeline timeline={timeline} responses={responses} />
      </div>

      {/* Responses table */}
      <div style={{
        marginTop: 18,
        background: 'var(--card)',
        border: '2px solid var(--line)',
        borderRadius: 20,
        boxShadow: '4px 5px 0 var(--line)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1.5px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="display" style={{ fontSize: 18 }}>Journal des réponses</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Plus récentes en haut
          </div>
        </div>
        {total === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-soft)' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🫥</div>
            Aucune réponse pour le moment.
          </div>
        ) : (
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {[...responses].reverse().map((r, i) => {
              const opt = OPTIONS.find(o => o.id === r.choice);
              return (
                <div key={r.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 60px 1fr auto',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 20px',
                  borderBottom: i === responses.length - 1 ? 'none' : '1px dashed var(--line)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                }}>
                  <span className="mono" style={{ color: 'var(--ink-soft)', fontSize: 12 }}>
                    #{String(responses.length - i).padStart(3, '0')}
                  </span>
                  <span style={{ fontSize: 24 }}>{opt?.emoji}</span>
                  <span style={{ fontSize: 14 }}>{opt?.label}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                    {new Date(r.ts).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button onClick={onBack} className="mono" style={{ ...adminBtn(), background: 'transparent' }}>← Retour au sondage</button>
      </div>
    </div>
  );
}

function adminBtn() {
  return {
    fontFamily: 'inherit',
    fontSize: 12,
    padding: '10px 16px',
    border: '1.5px solid var(--line)',
    background: 'var(--card)',
    color: 'var(--ink)',
    borderRadius: 999,
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    boxShadow: '2px 2px 0 var(--line)',
  };
}

function KPI({ label, value, sub, color }) {
  return (
    <div style={{
      background: color ? `var(--${color})` : 'var(--card)',
      border: '2px solid var(--line)',
      borderRadius: 18,
      padding: 18,
      boxShadow: '3px 4px 0 var(--line)',
    }}>
      <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: color ? `var(--${color}-ink)` : 'var(--ink-soft)', marginBottom: 8, opacity: 0.8 }}>
        {label}
      </div>
      <div className="display" style={{ fontSize: 40, lineHeight: 1, color: color ? `var(--${color}-ink)` : 'var(--ink)' }}>
        {value}
      </div>
      <div style={{ fontSize: 12, marginTop: 6, color: color ? `var(--${color}-ink)` : 'var(--ink-soft)', opacity: 0.85 }}>
        {sub}
      </div>
    </div>
  );
}

function BarChart({ stats, total }) {
  const max = Math.max(1, ...OPTIONS.map(o => stats[o.id].count));
  return (
    <div style={{
      background: 'var(--card)',
      border: '2px solid var(--line)',
      borderRadius: 20,
      padding: 24,
      boxShadow: '4px 5px 0 var(--line)',
    }}>
      <div className="display" style={{ fontSize: 18, marginBottom: 20 }}>Répartition des votes</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, height: 220, paddingBottom: 12, borderBottom: '1.5px solid var(--line)' }}>
        {OPTIONS.map(opt => {
          const s = stats[opt.id];
          const h = total > 0 ? (s.count / max) * 180 : 0;
          const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
          return (
            <div key={opt.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{s.count}</div>
              <div style={{
                width: '100%',
                height: Math.max(h, total > 0 && s.count > 0 ? 12 : 4),
                background: `var(--${opt.color})`,
                border: '2px solid var(--line)',
                borderRadius: '12px 12px 0 0',
                boxShadow: '2px -2px 0 var(--line) inset',
                transition: 'height 0.8s cubic-bezier(0.34, 1.3, 0.64, 1)',
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
        {OPTIONS.map(opt => {
          const s = stats[opt.id];
          const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
          return (
            <div key={opt.id} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 24 }}>{opt.emoji}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                {pct}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Timeline({ timeline, responses }) {
  // Show a sparkline-ish area of responses over last buckets
  const buckets = timeline.buckets;
  const max = Math.max(1, ...buckets.map(b => b.total));
  const W = 320, H = 140;
  const step = buckets.length > 1 ? W / (buckets.length - 1) : W;

  // Stacked area per category
  const categories = ['amazing', 'meh', 'useless'];
  const paths = {};
  let cumulative = buckets.map(() => 0);
  const points = {};
  categories.forEach(cat => {
    points[cat] = buckets.map((b, i) => {
      const prev = cumulative[i];
      const cur = prev + (b[cat] || 0);
      cumulative[i] = cur;
      return { x: i * step, yTop: H - (cur / max) * (H - 10), yBot: H - (prev / max) * (H - 10) };
    });
  });

  return (
    <div style={{
      background: 'var(--card)',
      border: '2px solid var(--line)',
      borderRadius: 20,
      padding: 24,
      boxShadow: '4px 5px 0 var(--line)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="display" style={{ fontSize: 18 }}>Évolution dans le temps</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {timeline.label}
        </div>
      </div>
      {responses.length === 0 ? (
        <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)', fontSize: 14 }}>
          📊 Les données apparaîtront ici
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: '100%', height: 'auto' }}>
          {/* grid */}
          {[0.25, 0.5, 0.75].map(t => (
            <line key={t} x1={0} x2={W} y1={H * t} y2={H * t} stroke="var(--ink)" strokeOpacity="0.08" strokeDasharray="2 3" />
          ))}
          {/* stacked areas */}
          {categories.map(cat => {
            const p = points[cat];
            if (p.length === 0) return null;
            const top = p.map(pt => `${pt.x},${pt.yTop}`).join(' ');
            const bot = [...p].reverse().map(pt => `${pt.x},${pt.yBot}`).join(' ');
            return (
              <polygon
                key={cat}
                points={`${top} ${bot}`}
                fill={`var(--${cat})`}
                stroke="var(--line)"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            );
          })}
          {/* x labels */}
          {buckets.map((b, i) => (
            i % Math.max(1, Math.floor(buckets.length / 4)) === 0 && (
              <text key={i} x={i * step} y={H + 14} fontSize="9" fontFamily="Geist Mono" textAnchor="middle" fill="var(--ink-soft)">
                {b.label}
              </text>
            )
          ))}
        </svg>
      )}
      <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
        {OPTIONS.map(opt => (
          <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{
              display: 'inline-block', width: 12, height: 12,
              background: `var(--${opt.color})`, border: '1.5px solid var(--line)', borderRadius: 3,
            }} />
            <span className="mono" style={{ color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{opt.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Tweaks panel ----------
function TweaksPanel({ tweaks, setTweak }) {
  return (
    <div className="tweaks">
      <h4>Tweaks</h4>
      <div className="label">Thème</div>
      <div className="row">
        {['sunny', 'neon', 'pastel'].map(v => (
          <button key={v} className={tweaks.theme === v ? 'active' : ''} onClick={() => setTweak('theme', v)}>{v}</button>
        ))}
      </div>
      <div className="label">Disposition</div>
      <div className="row">
        {['cards', 'stack'].map(v => (
          <button key={v} className={tweaks.layout === v ? 'active' : ''} onClick={() => setTweak('layout', v)}>{v}</button>
        ))}
      </div>
      <div className="label">Style boutons</div>
      <div className="row">
        {['chunky', 'flat'].map(v => (
          <button key={v} className={tweaks.buttonStyle === v ? 'active' : ''} onClick={() => setTweak('buttonStyle', v)}>{v}</button>
        ))}
      </div>
    </div>
  );
}

// ---------- helpers ----------
function computeStats(responses) {
  const out = { amazing: { count: 0 }, meh: { count: 0 }, useless: { count: 0 } };
  responses.forEach(r => {
    if (out[r.choice]) out[r.choice].count++;
  });
  return out;
}

function computeTimeline(responses) {
  if (responses.length === 0) {
    return { buckets: [], label: 'En attente' };
  }
  const now = Date.now();
  const first = responses[0].ts;
  const span = now - first;
  const oneHour = 60 * 60 * 1000;

  let bucketSize, count, fmt, label;
  if (span < oneHour) {
    bucketSize = 5 * 60 * 1000; // 5 min
    count = 12;
    label = 'Dernière heure';
    fmt = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } else if (span < 24 * oneHour) {
    bucketSize = oneHour;
    count = 24;
    label = 'Dernières 24h';
    fmt = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit' }) + 'h';
  } else {
    bucketSize = oneHour * 24;
    count = 7;
    label = 'Derniers jours';
    fmt = (d) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  const start = now - bucketSize * (count - 1);
  const buckets = [];
  for (let i = 0; i < count; i++) {
    const t = start + i * bucketSize;
    buckets.push({ t, label: fmt(new Date(t)), amazing: 0, meh: 0, useless: 0, total: 0 });
  }
  responses.forEach(r => {
    const idx = Math.floor((r.ts - start) / bucketSize);
    if (idx >= 0 && idx < buckets.length) {
      buckets[idx][r.choice] = (buckets[idx][r.choice] || 0) + 1;
      buckets[idx].total++;
    }
  });

  return { buckets, label };
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

// ---------- Seed some demo data if empty (for first-view only) ----------
(function seedDemoData() {
  const existing = loadResponses();
  if (existing.length > 0) return;
  const now = Date.now();
  const demo = [
    { id: 'd1', choice: 'amazing', ts: now - 1000 * 60 * 45 },
    { id: 'd2', choice: 'amazing', ts: now - 1000 * 60 * 32 },
    { id: 'd3', choice: 'meh', ts: now - 1000 * 60 * 28 },
    { id: 'd4', choice: 'amazing', ts: now - 1000 * 60 * 21 },
    { id: 'd5', choice: 'useless', ts: now - 1000 * 60 * 15 },
    { id: 'd6', choice: 'amazing', ts: now - 1000 * 60 * 12 },
    { id: 'd7', choice: 'meh', ts: now - 1000 * 60 * 7 },
    { id: 'd8', choice: 'amazing', ts: now - 1000 * 60 * 3 },
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
})();

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
