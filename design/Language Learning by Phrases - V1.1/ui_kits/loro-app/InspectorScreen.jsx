function InspectorScreen({ api }) {
  const { msgs, sel, saved, toast } = api;
  const cur = msgs[sel] || msgs[0];
  const isThem = cur.from === 'them';
  const fixes = cur.fixes || [];
  const curSaved = !!saved[cur.es];

  return (
    <PhoneFrame accent={api.accent} surface="chat">
      <StatusBar />

      <div style={{ flex: 'none', padding: '2px 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <InlineAction tone="quiet" onClick={api.backToChat} style={{ width: 34, justifyContent: 'center', fontSize: 16 }}>‹</InlineAction>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: isThem ? 'var(--ink-4)' : 'var(--accent-ink)', letterSpacing: '.04em' }}>{isThem ? 'Loro' : 'You'}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-9)', fontVariantNumeric: 'tabular-nums' }}>{sel + 1} / {msgs.length}</span>
        </div>
        <InlineAction onClick={() => api.setSel(Math.max(0, sel - 1))} style={{ width: 34, justifyContent: 'center', fontSize: 16 }}>‹</InlineAction>
        <InlineAction onClick={() => api.setSel(Math.min(msgs.length - 1, sel + 1))} style={{ width: 34, justifyContent: 'center', fontSize: 16 }}>›</InlineAction>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 26 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 27, lineHeight: 1.2, letterSpacing: '-0.012em' }}>{cur.es}</div>
          {cur.en ? <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 8, lineHeight: 1.45 }}>{cur.en}</div> : null}
          {cur.resp ? <div style={{ fontSize: 11.5, color: 'var(--ink-8)', fontStyle: 'italic', marginTop: 5 }}>{cur.resp}</div> : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line-hair)' }}>
            <InlineAction glyph="♪" tone="accent" onClick={() => api.say(cur.es)}>Hear</InlineAction>
            <InlineAction onClick={() => api.say(cur.es, 0.6)}>Slow</InlineAction>
            {!isThem ? <InlineAction onClick={() => api.shadow(sel)}>Say again</InlineAction> : null}
            <div style={{ flex: 1 }} />
            <InlineAction tone={curSaved ? 'grow' : 'accent'} onClick={() => api.saveMsg(sel)}>{curSaved ? 'Kept' : 'Keep it'}</InlineAction>
          </div>
        </div>

        {fixes.length ? (
          <div>
            <SectionLabel>{fixes.length === 1 ? 'One thing to fix' : fixes.length + ' things to fix'}</SectionLabel>
            {fixes.map((f, i) => <DiffRow key={f.was} first={i === 0} was={f.was} now={f.now} kind={f.kind} why={f.why} />)}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SectionLabel>Say it like this</SectionLabel>
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, marginTop: 5 }}>{cur.fixed}</div>
              </div>
              <InlineAction glyph="♪" tone="faint" onClick={() => api.say(cur.fixed)} style={{ width: 36, justifyContent: 'center' }} />
            </div>
            <PillButton full onClick={api.applyFix} style={{ marginTop: 12, width: '100%' }}>Use it &amp; keep the fix</PillButton>
          </div>
        ) : null}

        {!isThem && !fixes.length ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 12, color: 'var(--grow-soft)' }}>✓</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--grow-soft)' }}>Nothing to fix — this reads naturally.</span>
          </div>
        ) : null}

        <div>
          <SectionLabel>{isThem ? 'Other ways to say it' : 'More natural ways'}</SectionLabel>
          {(cur.alts || []).map((a, i) => (
            <PhraseRow key={a.es} first={i === 0} es={a.es} en={a.en} register={a.reg}
              state={saved[a.es] ? 'saved' : 'add'} onPick={() => api.addAlt(a)} onHear={() => api.say(a.es)} />
          ))}
        </div>

        {cur.words ? (
          <div>
            <SectionLabel style={{ marginBottom: 4 }}>Word by word</SectionLabel>
            {cur.words.map((w, i) => (
              <ListRow key={w.es} first={i === 0} onClick={() => api.say(w.es, 0.72)} style={{ alignItems: 'baseline', gap: 10, padding: '9px 0' }}>
                <span style={{ flex: 'none', fontSize: 14, fontWeight: 700 }}>{w.es}</span>
                <span style={{ flex: 1, fontSize: 11.5, color: 'var(--ink-7)' }}>{w.gloss}</span>
                <span style={{ flex: 'none', fontSize: 12, color: 'var(--ink-10)' }}>♪</span>
              </ListRow>
            ))}
          </div>
        ) : null}

        {cur.why ? (
          <div style={{ borderLeft: '1px solid var(--line-field)', paddingLeft: 14 }}>
            <SectionLabel style={{ color: 'var(--ink-8)' }}>Why it's said this way</SectionLabel>
            <div style={{ fontSize: 12.5, color: 'var(--ink-5)', lineHeight: 1.6, marginTop: 5, textWrap: 'pretty' }}>{cur.why}</div>
          </div>
        ) : null}
      </div>

      <Toast bottom={34}>{toast}</Toast>
    </PhoneFrame>
  );
}
