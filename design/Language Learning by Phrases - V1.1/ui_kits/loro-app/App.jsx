const { useState, useRef, useEffect } = React;

const THREAD = [
  { from: 'them', es: '¡Buenas, Mara! ¿Cómo va la mañana?', en: "Morning, Mara! How's the morning going?",
    resp: 'BWEH-nahs MAH-rah — KOH-moh bah lah mah-NYAH-nah',
    why: '“¿Cómo va…?” asks how something is going. It lands warmer than “¿Cómo estás?” and it is what you will actually hear first thing in Spain.',
    words: [{ es: 'Buenas', gloss: 'hi (short for buenos días)' }, { es: 'cómo va', gloss: 'how goes' }, { es: 'la mañana', gloss: 'the morning' }],
    alts: [{ es: '¿Qué tal la mañana?', en: "How's the morning?", reg: 'casual' }, { es: '¿Cómo ha empezado el día?', en: 'How has the day started?', reg: 'formal' }, { es: '¿Todo bien?', en: 'All good?', reg: 'shortest' }],
    sugg: [{ es: 'Muy bien, gracias. ¿Y tú?', en: 'Very well, thanks. And you?', reg: 'safe' }, { es: 'Un poco cansada, la verdad.', en: 'A bit tired, honestly.', reg: 'honest' }, { es: 'Voy tirando.', en: "I'm getting by.", reg: 'very local' }] },
  { from: 'me', es: 'Muy bien, gracias. Yo estoy un poco cansado.', en: 'Very well, thanks. I am a bit tired.',
    fixes: [
      { kind: 'Extra word', was: 'Yo estoy', now: 'Estoy', why: 'Spanish carries the subject in the verb. Leaving “yo” in makes it emphatic — as if you and nobody else were the tired one.' },
      { kind: 'Agreement', was: 'cansado', now: 'cansada', why: 'You set your profile to feminine, so the adjective ends in -a. Nouns and adjectives have to agree.' },
    ],
    fixed: 'Muy bien, gracias. Estoy un poco cansada.',
    alts: [{ es: 'Bien, aunque con sueño.', en: 'Good, though sleepy.', reg: 'natural' }, { es: 'Bastante bien, gracias.', en: 'Pretty good, thanks.', reg: 'neutral' }, { es: 'Voy tirando.', en: "I'm getting by.", reg: 'very local' }] },
  { from: 'them', es: 'Te entiendo. ¿Te apetece un café antes de empezar?', en: 'I get you. Fancy a coffee before we start?',
    resp: 'teh en-tee-EN-doh — teh ah-peh-TEH-theh oon kah-FEH',
    why: '“Apetecer” runs backwards from English: the coffee appeals to you. So it is “te apetece”, never “tú apeteces”.',
    words: [{ es: 'te entiendo', gloss: 'I understand you' }, { es: 'te apetece', gloss: 'do you fancy' }, { es: 'antes de', gloss: 'before' }],
    alts: [{ es: '¿Quieres un café?', en: 'Do you want a coffee?', reg: 'plainer' }, { es: '¿Nos tomamos un café?', en: 'Shall we grab a coffee?', reg: 'inclusive' }, { es: '¿Un café y arrancamos?', en: 'A coffee and we get going?', reg: 'playful' }],
    sugg: [{ es: 'Sí, me apetece mucho.', en: "Yes, I'd love one.", reg: 'warm' }, { es: 'Un cortado, si puede ser.', en: 'A cortado, if possible.', reg: 'ordering' }, { es: 'Mejor un té, gracias.', en: 'A tea instead, thanks.', reg: 'polite swap' }] },
];

const REPLY = { from: 'them', es: 'Marchando un café. ¿Solo o con leche?', en: 'Coffee coming up. Black or with milk?',
  resp: 'mar-CHAN-doh oon kah-FEH — SOH-loh oh kon LEH-cheh',
  why: '“Marchando” is what staff shout when an order is on its way. Warm, quick, very Spanish.',
  words: [{ es: 'marchando', gloss: 'coming right up' }, { es: 'solo', gloss: 'black' }, { es: 'con leche', gloss: 'with milk' }],
  alts: [{ es: '¿Cómo lo quieres?', en: 'How do you want it?', reg: 'casual' }, { es: '¿Con leche o sin?', en: 'With milk or without?', reg: 'shorter' }, { es: '¿Le pongo leche?', en: 'Shall I add milk?', reg: 'formal' }],
  sugg: [{ es: 'Con leche, por favor.', en: 'With milk, please.', reg: 'safe' }, { es: 'Solo y bien cargado.', en: 'Black and strong.', reg: 'confident' }, { es: 'Con un poco de leche.', en: 'With a little milk.', reg: 'precise' }] };

const TOPICS = ['Morning talk', 'At the café', 'Weekend plans', 'Asking directions'];

function checkDraft(text) {
  const fixes = []; let fixed = text;
  if (/\byo\s/i.test(text)) { fixes.push({ kind: 'Extra word', was: 'yo', now: '—', why: 'Spanish carries the subject in the verb, so “yo” reads as emphasis rather than information.' }); fixed = fixed.replace(/\byo\s+/i, ''); fixed = fixed.charAt(0).toUpperCase() + fixed.slice(1); }
  if (/\bcafe\b/i.test(text)) { fixes.push({ kind: 'Accent', was: 'cafe', now: 'café', why: 'The stress lands on the last syllable, so it takes an acute accent.' }); fixed = fixed.replace(/\bcafe\b/i, 'café'); }
  if (/\bquiero\b/i.test(text)) { fixes.push({ kind: 'Register', was: 'quiero', now: 'me pone', why: '“Quiero” is correct but blunt when ordering. “Me pone” is what you will hear at the bar.' }); fixed = fixed.replace(/\bquiero\b/i, 'me pone'); }
  return { fixes, fixed };
}

function App() {
  const [view, setView] = useState('chat');
  const [accent, setAccent] = useState('coral');
  const [msgs, setMsgs] = useState(THREAD);
  const [sel, setSel] = useState(1);
  const [rev, setRev] = useState({});
  const [saved, setSaved] = useState({});
  const [draft, setDraft] = useState('');
  const [mic, setMic] = useState('idle');
  const [heard, setHeard] = useState('');
  const [sheet, setSheet] = useState('');
  const [topic, setTopic] = useState(0);
  const [pace, setPace] = useState('natural');
  const [suggest, setSuggest] = useState(false);
  const [typing, setTyping] = useState(false);
  const [toast, setToast] = useState('');
  const tt = useRef(null);
  const mt = useRef(null);
  const held = useRef(0);

  useEffect(() => () => { clearTimeout(tt.current); clearTimeout(mt.current); }, []);
  const say = (t, rate) => { try { const u = new SpeechSynthesisUtterance(t); u.lang = 'es-ES'; u.rate = rate || (pace === 'simple' ? 0.74 : 0.98); speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {} };
  const flash = (m) => { setToast(m); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(''), 2000); };
  const keep = (es, en, note) => { setSaved(s => (s[es] ? s : { ...s, [es]: { es, en: en || '', note: note || '' } })); };

  const api = {
    accent, setAccent, msgs, sel, setSel, rev, saved, draft, mic, heard, sheet, topic, pace, suggest, typing, toast,
    topics: TOPICS,
    say, flash,
    toggleRev: (i) => setRev(r => ({ ...r, [i]: !r[i] })),
    saveMsg: (i) => { const m = msgs[i]; if (!m) return; if (saved[m.es]) { flash('Already in your stream'); return; } keep(m.es, m.en); flash('Saved to your stream'); },
    addAlt: (a) => { if (saved[a.es]) { flash('Already in your stream'); return; } keep(a.es, a.en, 'Alternative from chat · ' + a.reg); flash('Added — ' + a.reg); },
    applyFix: () => {
      const m = msgs[sel]; if (!m || !m.fixes) return;
      setMsgs(list => list.map((x, i) => (i === sel ? { ...x, es: x.fixed, fixes: null, wasFixed: true } : x)));
      keep(m.fixed, m.en, 'Fixed in chat'); say(m.fixed); flash('Fixed — and saved to practice');
    },
    setDraft, setSuggest,
    fixDraft: () => { const fx = checkDraft(draft.trim()); if (!fx.fixes.length) return; setDraft(fx.fixed); flash(fx.fixes[0].was + ' → ' + fx.fixes[0].now); },
    check: () => (draft.trim() ? checkDraft(draft.trim()).fixes[0] : null),
    send: (text) => {
      const t = (text != null ? text : draft).trim(); if (!t) return;
      const fx = checkDraft(t);
      const next = [...msgs, { from: 'me', es: t, en: '', fixes: fx.fixes, fixed: fx.fixed, alts: THREAD[1].alts }];
      setMsgs(next); setSel(next.length - 1); setDraft(''); setHeard(''); setMic('idle'); setSuggest(false); setTyping(true);
      clearTimeout(mt.current);
      mt.current = setTimeout(() => {
        setTyping(false);
        setMsgs(m2 => { const withReply = [...m2, REPLY]; setSel(withReply.length - 1); return withReply; });
        say(REPLY.es);
      }, 1200);
    },
    micDown: () => { held.current = Date.now(); clearTimeout(mt.current); setMic('holding'); setHeard(''); setSuggest(false); },
    micUp: () => {
      const dt = Date.now() - held.current;
      if (dt < 420) { setMic('locked'); clearTimeout(mt.current); mt.current = setTimeout(() => api.resolveMic(), 2200); return; }
      api.resolveMic();
    },
    resolveMic: () => {
      clearTimeout(mt.current);
      const last = [...msgs].reverse().find(m => m.from === 'them' && m.sugg);
      setMic('idle'); setHeard((last && last.sugg[0].es) || 'Sí, claro.');
    },
    cancelMic: () => { clearTimeout(mt.current); setMic('idle'); setHeard(''); },
    shadow: (i) => { const m = msgs[i]; if (!m) return; say(m.fixed || m.es, 0.68); setSel(i); clearTimeout(mt.current); mt.current = setTimeout(() => { setMic('locked'); mt.current = setTimeout(() => api.resolveMic(), 1900); }, 1400); },
    openSheet: (k) => setSheet(k), closeSheet: () => setSheet(''),
    pickTopic: (i) => { setTopic(i); setSheet(''); flash('Now talking about ' + TOPICS[i].toLowerCase()); },
    setPace: (p) => { setPace(p); flash(p === 'simple' ? 'Loro slows down' : 'Loro talks at natural speed'); },
    unkeep: (rec) => setSaved(s => { const m = { ...s }; delete m[rec.es]; return m; }),
    clearChat: () => { setMsgs(THREAD); setSel(1); setSheet(''); setDraft(''); setHeard(''); setTyping(false); flash('Fresh conversation'); },
    sendToReview: () => { const n = Object.keys(saved).length; setSheet(''); flash(n ? n + (n === 1 ? ' line' : ' lines') + ' queued for today' : 'Nothing kept yet'); },
    openInspector: (i) => { setSel(i); setView('inspector'); },
    backToChat: () => setView('chat'),
  };

  const tab = (id, label) => (
    React.createElement('div', {
      key: id, className: 'lo-tap', onClick: () => setView(id),
      style: { display: 'flex', alignItems: 'center', padding: '0 13px', borderRadius: 'var(--r-pill)', cursor: 'pointer', background: view === id ? 'var(--ink-1)' : 'transparent', border: '1px solid ' + (view === id ? 'var(--ink-1)' : 'var(--line-field)') },
    }, React.createElement('span', { style: { fontSize: 11.5, fontWeight: 700, color: view === id ? 'var(--paper-screen)' : 'var(--ink-3)' } }, label))
  );

  return (
    <div data-accent={accent} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.18em', color: 'var(--ink-3)' }}>LORO · APP UI KIT</div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: 'var(--track-display)', marginTop: 4 }}>The conversation loop</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 7 }}>{[['chat', 'Chat'], ['inspector', 'Inspector'], ['today', 'Today']].map(([id, l]) => tab(id, l))}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['coral', 'sunset', 'teal', 'berry'].map(a => (
            <div key={a} className="lo-tap" onClick={() => setAccent(a)} data-accent={a}
              style={{ width: 26, height: 26, minWidth: 26, minHeight: 26, borderRadius: '50%', background: 'var(--accent)', cursor: 'pointer', outline: accent === a ? '2px solid var(--ink-1)' : 'none', outlineOffset: 2 }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
        {view === 'chat' ? <ChatScreen api={api} /> : null}
        {view === 'inspector' ? <InspectorScreen api={api} /> : null}
        {view === 'today' ? <TodayScreen api={api} /> : null}
        <div style={{ maxWidth: 330, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{view === 'chat' ? 'Talk by voice or text' : view === 'inspector' ? 'One line, opened' : 'The today surface'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55, textWrap: 'pretty' }}>
            {view === 'chat'
              ? 'Tap a line to select it, then EN to reveal the translation, ♪ to hear it, or Open to take it apart. Hold the mic to talk; tap it to keep listening. Type “quiero un cafe” to see the live check.'
              : view === 'inspector'
                ? 'Audio at two speeds, other ways to say the same thing, word glosses, and — on your own lines — a plain diff with reasoning. Keeping anything sends it to the same stream as daily review.'
                : 'A closed, finite set of five you can see in full and finish, three waves across the day, the ambient loop, and the rolling window of fading tail plus banked phrases.'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-7)', lineHeight: 1.5 }}>Built from <b>components/</b>: PhoneFrame, StatusBar, MessageBubble, PhraseRow, DiffRow, MicButton, BottomSheet, Toast, PillButton, InlineAction, Card, Tag, ListRow, SectionLabel, LadderPips, MeterBar, StatFigure.</div>
        </div>
      </div>
    </div>
  );
}
