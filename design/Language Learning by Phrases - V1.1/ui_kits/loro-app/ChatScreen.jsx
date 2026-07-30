function ChatScreen({ api }) {
  const { msgs, sel, rev, saved, draft, mic, heard, sheet, topic, pace, suggest, typing, toast, topics } = api;
  const scroller = React.useRef(null);
  React.useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.length, typing, suggest, mic, heard]);
  const check = api.check();
  const lastSugg = [...msgs].reverse().find(m => m.from === 'them' && m.sugg);
  const suggestions = (lastSugg && lastSugg.sugg) || [];
  const kept = Object.values(saved);

  return (
    <PhoneFrame accent={api.accent} surface="chat">
      <StatusBar />

      <div style={{ flex: 'none', padding: '2px 18px 10px', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <div className="lo-tap" onClick={() => api.openSheet('topic')} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.016em' }}>Loro</div>
          <div style={{ fontSize: 11, color: 'var(--ink-6)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{topics[topic]} · {pace === 'simple' ? 'slow speech' : 'natural speed'} ⌄</div>
        </div>
        <InlineAction tone="faint" onClick={() => api.openSheet('kept')} style={{ padding: '0 6px' }}>{kept.length ? kept.length + ' kept' : 'Nothing kept'}</InlineAction>
      </div>

      <div ref={scroller} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 18px 12px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ flex: 1, minHeight: 0 }} />
        {msgs.map((m, i) => (
          <MessageBubble key={i} from={m.from} es={m.es} en={m.en} showEn={!!rev[i]} selected={i === sel}
            fixCount={(m.fixes || []).length} onClick={() => api.setSel(i)}>
            {m.from === 'me'
              ? <InlineAction glyph="↻" onClick={() => api.shadow(i)}>Say again</InlineAction>
              : <InlineAction glyph="♪" onClick={() => api.say(m.es)}>Hear</InlineAction>}
            {m.en ? <InlineAction tone={rev[i] ? 'accent' : 'quiet'} onClick={() => api.toggleRev(i)}>{rev[i] ? 'Hide' : 'EN'}</InlineAction> : null}
            <InlineAction tone={saved[m.es] ? 'grow' : 'quiet'} onClick={() => api.saveMsg(i)}>{saved[m.es] ? 'Saved' : 'Save'}</InlineAction>
            <InlineAction tone={(m.fixes || []).length ? 'accent' : 'quiet'} onClick={() => api.openInspector(i)}>
              {(m.fixes || []).length ? 'Fix ' + m.fixes.length + ' ›' : 'Open ›'}
            </InlineAction>
          </MessageBubble>
        ))}
        {typing ? (
          <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
            {[0, 0.15, 0.3].map(d => <div key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ink-10)', animation: `barJump .9s ease-in-out infinite ${d}s` }} />)}
          </div>
        ) : null}
      </div>

      <div style={{ flex: 'none', padding: '8px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {suggest ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 2px 7px' }}>
              <SectionLabel style={{ flex: 1 }}>Ways to answer</SectionLabel>
              <InlineAction tone="faint" onClick={() => api.setSuggest(false)}>Hide</InlineAction>
            </div>
            {suggestions.map((sg, i) => (
              <PhraseRow key={sg.es} first={i === 0} es={sg.es} en={sg.en} register={sg.reg}
                onPick={() => { api.setDraft(sg.es); api.setSuggest(false); api.say(sg.es); }}
                onHear={() => api.say(sg.es)} onSecondary={() => api.send(sg.es)} />
            ))}
            <div style={{ fontSize: 10, color: 'var(--ink-8)', padding: '8px 2px 0', lineHeight: 1.45 }}>Tap the phrase to put it in the field and edit it — or <b style={{ color: 'var(--ink-6)' }}>Send</b> it as is.</div>
          </div>
        ) : null}

        {!suggest && mic === 'idle' && !heard ? (
          <div className="lo-tap" onClick={() => api.setSuggest(true)} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--line-field)', borderRadius: 18, padding: '0 12px', cursor: 'pointer' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-6)' }}>⇄</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)' }}>Ways to answer</span>
          </div>
        ) : null}

        {check ? (
          <div className="lo-tap" onClick={api.fixDraft} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 2px', cursor: 'pointer' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-7)', textDecoration: 'line-through' }}>{check.was}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-10)' }}>→</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-ink)' }}>{check.now}</span>
            <span style={{ flex: 1, fontSize: 10, color: 'var(--ink-7)' }}>{check.kind.toLowerCase()}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-ink)', letterSpacing: '.04em' }}>Fix</span>
          </div>
        ) : null}

        {mic !== 'idle' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'color-mix(in srgb, var(--accent) 9%, var(--paper-screen-quiet))', borderRadius: 24, padding: '0 8px 0 16px', minHeight: 52 }}>
              <div style={{ flex: 'none', display: 'flex', alignItems: 'flex-end', gap: 3, height: 22 }}>
                {[8, 18, 12, 22, 14].map((h, i) => <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: 'var(--accent)', animation: `eqB .9s ease-in-out infinite ${i * 0.1}s` }} />)}
              </div>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--accent-ink)' }}>{mic === 'locked' ? 'Listening…' : 'Keep talking'}</span>
              <InlineAction tone="faint" onClick={api.cancelMic} style={{ width: 40, justifyContent: 'center' }}>×</InlineAction>
              {mic === 'locked'
                ? <PillButton onClick={api.resolveMic} style={{ minHeight: 40, borderRadius: 'var(--r-pill)', padding: '0 15px', fontSize: 12 }}>Done</PillButton>
                : <MicButton state="holding" onPointerUp={api.micUp} onCancel={api.cancelMic} />}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink-8)', paddingLeft: 4 }}>{mic === 'locked' ? 'Tap Done when you finish' : 'Release to send'}</div>
          </div>
        ) : null}

        {mic === 'idle' && heard ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8, borderTop: '1px solid var(--line-hair)' }}>
            <SectionLabel>Heard you say</SectionLabel>
            <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{heard}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <InlineAction tone="faint" onClick={api.micDown}>Again</InlineAction>
              <InlineAction tone="accent" onClick={() => api.send(heard)}>Send it →</InlineAction>
            </div>
          </div>
        ) : null}

        {mic === 'idle' && !heard ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line-field)', minHeight: 44 }}>
                <input value={draft} onChange={e => api.setDraft(e.target.value)} placeholder="Escribe en español…"
                  style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, color: 'var(--ink-1)' }} />
                {draft.trim() ? <InlineAction tone="accent" onClick={() => api.send()} style={{ width: 40, justifyContent: 'center', fontSize: 16 }}>→</InlineAction> : null}
              </div>
              {!draft.trim() ? <span style={{ fontSize: 10, color: 'var(--ink-8)' }}>Hold the mic to talk · tap it to keep listening</span> : null}
            </div>
            {!draft.trim() ? <MicButton state="idle" onPointerDown={api.micDown} onPointerUp={api.micUp} onCancel={api.cancelMic} /> : null}
          </div>
        ) : null}
      </div>

      <BottomSheet open={sheet === 'topic'} onClose={api.closeSheet}
        footer={<><InlineAction tone="alert" onClick={api.clearChat}>Start over</InlineAction><div style={{ flex: 1 }} /><InlineAction tone="strong" onClick={api.closeSheet}>Done</InlineAction></>}>
        <SectionLabel>Talk about</SectionLabel>
        {topics.map((t, i) => (
          <ListRow key={t} onClick={() => api.pickTopic(i)} style={{ borderTop: 'none', borderBottom: '1px solid var(--line-hair)' }}>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: i === topic ? 'var(--accent-ink)' : '#33302a' }}>{t}</span>
            {i === topic ? <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-ink)' }}>·</span> : null}
          </ListRow>
        ))}
        <SectionLabel style={{ marginTop: 16 }}>Loro's pace</SectionLabel>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {[['natural', 'Natural'], ['simple', 'Slow speech']].map(([k, l]) => (
            <PillButton key={k} full variant={pace === k ? 'dark' : 'secondary'} onClick={() => api.setPace(k)} style={{ minHeight: 40, borderRadius: 'var(--r-pill)', fontSize: 12 }}>{l}</PillButton>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'kept'} onClose={api.closeSheet}
        footer={<><InlineAction tone="accent" onClick={api.sendToReview}>Queue for today's review →</InlineAction><div style={{ flex: 1 }} /><InlineAction tone="strong" onClick={api.closeSheet}>Done</InlineAction></>}>
        <SectionLabel>Kept from this chat</SectionLabel>
        {kept.length === 0
          ? <div style={{ fontSize: 13, color: 'var(--ink-7)', lineHeight: 1.5, padding: '14px 0', textWrap: 'pretty' }}>Nothing yet. Tap a line, then <b style={{ color: 'var(--ink-4)' }}>Save</b> — it joins the same stream as your daily review.</div>
          : kept.map((k, i) => (
            <ListRow key={k.es} first={i === 0} style={{ borderTop: 'none', borderBottom: '1px solid var(--line-hair)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>{k.es}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-7)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.en || k.note}</div>
              </div>
              <InlineAction glyph="♪" onClick={() => api.say(k.es)} style={{ width: 34, justifyContent: 'center' }} />
              <InlineAction tone="faint" onClick={() => api.unkeep(k)} style={{ width: 30, justifyContent: 'center' }}>×</InlineAction>
            </ListRow>
          ))}
      </BottomSheet>

      <Toast>{toast}</Toast>
    </PhoneFrame>
  );
}
