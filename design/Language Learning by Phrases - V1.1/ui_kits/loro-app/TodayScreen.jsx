const TODAY_SET = [
  { es: 'Me pone un cortado, por favor', pct: 100, days: 'day 3', locked: true },
  { es: '¿Está incluida la propina?', pct: 72, days: 'day 2' },
  { es: 'Voy tirando', pct: 55, days: 'day 2' },
  { es: '¿Me trae la carta?', pct: 30, days: 'day 1' },
  { es: 'Nos lo tomamos en la terraza', pct: 12, days: 'day 1' },
];
const WAVES = [
  { label: 'Morning wave', sub: 'Five lines, cold start', time: '8:10', done: true },
  { label: 'Midday wave', sub: 'Speak them back', time: '13:30', done: true },
  { label: 'Evening wave', sub: 'The one you fumbled', time: '19:00', done: false },
];
const TAIL = [{ es: 'Una caña, por favor', days: 'day 6' }, { es: '¿Cómo va la mañana?', days: 'day 5' }];

function TodayScreen({ api }) {
  const [ambient, setAmbient] = React.useState(false);
  const [done, setDone] = React.useState({});
  const [toast, setToast] = React.useState('');
  const tt = React.useRef(null);
  const flash = (m) => { setToast(m); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(''), 1800); };
  const completed = WAVES.filter(w => w.done).length;

  return (
    <PhoneFrame accent={api.accent} surface="app">
      <StatusBar />

      <div style={{ flex: 'none', padding: '4px 18px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)' }}>Tuesday, 29 July</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 'var(--track-ui)' }}>Today</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--accent-tint)', borderRadius: 'var(--r-pill)', padding: '6px 11px' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-ink)' }}>14 days</span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 16px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card radius="var(--r-pill)" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 11 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Today's five</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)' }}>{Object.keys(done).length + 2} of 5 seen</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {TODAY_SET.map((p, i) => (
              <div key={p.es} className="lo-tap" onClick={() => { setDone(d => ({ ...d, [i]: true })); api.say(p.es); flash('Played · ' + p.es); }} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.es}</span>
                  {p.locked ? <Tag tone="accent">locked</Tag> : null}
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-4)' }}>{p.days}</span>
                </div>
                <MeterBar value={done[i] ? Math.min(100, p.pct + 20) : p.pct} tone={p.pct === 100 ? 'grow' : 'accent'} height={6} track="var(--paper-well)" />
              </div>
            ))}
          </div>
        </Card>

        <div>
          <SectionLabel style={{ marginBottom: 9, paddingLeft: 2 }}>Today's three waves</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {WAVES.map(w => (
              <div key={w.label} style={{ display: 'flex', alignItems: 'center', gap: 11, background: w.done ? 'var(--grow-surface)' : 'var(--paper-raised)', border: '1.5px solid ' + (w.done ? 'var(--grow-line)' : 'var(--line-card)'), borderRadius: 'var(--r-card-lg)', padding: '11px 13px' }}>
                <div style={{ width: 26, height: 26, flex: 'none', borderRadius: '50%', background: '#fff', border: '1.5px solid ' + (w.done ? 'var(--grow)' : 'var(--ink-9)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: w.done ? 'var(--grow)' : 'var(--ink-6)' }}>{w.done ? '✓' : '·'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{w.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{w.sub}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)' }}>{w.time}</span>
              </div>
            ))}
          </div>
        </div>

        <Card tone="dark" onClick={() => { setAmbient(a => !a); flash(ambient ? 'Ambient loop paused' : 'Ambient loop playing'); }}
          style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'linear-gradient(165deg,#332e27,#141310)', padding: '13px 15px' }}>
          <div style={{ width: 38, height: 38, flex: 'none', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff' }}>{ambient ? '❙❙' : '▶'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{ambient ? 'Playing your five' : 'Play your five on a loop'}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-on-dark-muted)' }}>Hands-free · catchy on a loop</div>
          </div>
          {ambient ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 18 }}>
              {[8, 16, 11].map((h, i) => <div key={i} style={{ width: 3, height: h, background: 'var(--accent-on-dark)', borderRadius: 2, animation: `eqB 1s ease-in-out infinite ${i * 0.2}s` }} />)}
            </div>
          ) : null}
        </Card>

        <div style={{ display: 'flex', gap: 9 }}>
          <Card style={{ flex: 1, borderRadius: 'var(--r-card-lg)', padding: '11px 12px' }}>
            <SectionLabel style={{ marginBottom: 7, letterSpacing: 'var(--track-caps-tight)' }}>Fading tail</SectionLabel>
            {TAIL.map(t => (
              <div key={t.es} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.es}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', flex: 'none' }}>{t.days}</span>
              </div>
            ))}
          </Card>
          <Card style={{ flex: 'none', width: 96, borderRadius: 'var(--r-card-lg)', padding: '11px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <StatFigure value="41" label="Banked" size="sm" />
          </Card>
        </div>
      </div>

      <div style={{ flex: 'none', padding: '10px 16px 16px' }}>
        <PillButton full onClick={() => flash(completed < 3 ? 'Evening wave started' : 'All three waves done')} style={{ width: '100%', minHeight: 50, borderRadius: 'var(--r-card)', fontSize: 15 }}>
          {completed < 3 ? 'Start the evening wave' : 'Today is done'}
        </PillButton>
      </div>

      <Toast bottom={26}>{toast}</Toast>
    </PhoneFrame>
  );
}
