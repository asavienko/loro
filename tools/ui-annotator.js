/*
 * ui-annotator.js - point-and-comment overlay for local dev.
 *
 * Loaded by Playwright MCP via --init-script, so it runs in every page the
 * MCP browser opens. Claude reads comments with browser_evaluate:
 *   () => window.__uiComments.list()
 *
 * Toggle comment mode: Alt+Shift+C, or click the pill (bottom-right).
 * In comment mode: click an element to comment on it.
 *                  Hold Shift to click through and use the app normally.
 *                  Esc closes the popover, then exits comment mode.
 * Comments live in sessionStorage, so they survive reloads and HMR.
 */
;(() => {
  'use strict'

  // Top frame, local dev hosts only. Add staging hosts here if you need them.
  if (window.top !== window) return
  const h = location.hostname
  const isLocal =
    ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(h) || h.endsWith('.localhost')
  if (!isLocal || window.__uiComments) return

  const KEY = '__ui_comments_v1'
  const here = () => location.pathname + location.search
  const load = () => {
    try {
      return JSON.parse(sessionStorage.getItem(KEY)) || []
    } catch {
      return []
    }
  }
  const save = (list) => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(list))
    } catch {}
    render()
  }

  // ---------- element description (what Claude gets) ----------

  const cssPath = (el) => {
    if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) {
      return '#' + CSS.escape(el.id)
    }
    const tid = el.getAttribute('data-testid')
    if (tid) return `[data-testid="${tid.replace(/"/g, '\\"')}"]`
    const parts = []
    let node = el
    while (node && node.nodeType === 1 && node !== document.body && parts.length < 7) {
      if (node.id) {
        parts.unshift('#' + CSS.escape(node.id))
        break
      }
      let part = node.localName
      const parent = node.parentElement
      if (parent) {
        const same = [...parent.children].filter((c) => c.localName === node.localName)
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`
      }
      parts.unshift(part)
      node = parent
    }
    return parts.join(' > ')
  }

  // Best effort: nearest React component names, plus file:line where the
  // dev build exposes it (React <= 18 _debugSource).
  const reactInfo = (el) => {
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'))
    if (!key) return null
    let fiber = el[key]
    const components = []
    let source = null
    while (fiber && components.length < 4) {
      if (!source && fiber._debugSource) {
        source = `${fiber._debugSource.fileName}:${fiber._debugSource.lineNumber}`
      }
      const t = fiber.type
      if (t && (typeof t === 'function' || typeof t === 'object')) {
        const name = t.displayName || t.name || t.render?.displayName || t.render?.name
        if (name) components.push(name)
      }
      fiber = fiber.return
    }
    return { components, source }
  }

  const STYLE_PROPS = [
    'display',
    'position',
    'color',
    'background-color',
    'font-size',
    'font-weight',
    'line-height',
    'padding',
    'margin',
    'gap',
    'border-radius',
    'width',
    'height',
  ]

  const describe = (el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      selector: cssPath(el),
      tag: el.localName,
      id: el.id || null,
      classes: [...el.classList].slice(0, 12),
      testid: el.getAttribute('data-testid'),
      text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 120),
      html: el.outerHTML.slice(0, 600),
      react: reactInfo(el),
      styles: Object.fromEntries(STYLE_PROPS.map((p) => [p, cs.getPropertyValue(p)])),
      rect: {
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
      },
      viewport: { width: innerWidth, height: innerHeight },
    }
  }

  // ---------- API for Claude ----------

  window.__uiComments = Object.freeze({
    list: () => load().filter((c) => !c.resolved),
    all: load,
    resolve: (ids) => save(load().map((c) => (ids.includes(c.id) ? { ...c, resolved: true } : c))),
    clear: () => save([]),
  })

  // ---------- overlay UI (shadow DOM, so page CSS can't touch it) ----------

  const CSS_TEXT = `
    * { box-sizing: border-box; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
    [hidden] { display: none !important; }
    .hl { position: fixed; border: 2px solid #ff2d95; background: rgba(255,45,149,.08);
          border-radius: 3px; pointer-events: none; }
    .tag { position: absolute; top: -24px; left: -2px; background: #ff2d95; color: #fff;
           font-size: 12px; padding: 1px 6px; border-radius: 3px; white-space: nowrap; }
    .pill { position: fixed; right: 16px; bottom: 16px; pointer-events: auto; border: 0;
            border-radius: 999px; padding: 8px 14px; background: #1f1a2e; color: #fff;
            cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
    .pill.on { background: #ff2d95; }
    .pop { position: fixed; width: 320px; pointer-events: auto; background: #fff; color: #1f1a2e;
           border: 1px solid #d8d4e3; border-radius: 8px; padding: 12px;
           box-shadow: 0 8px 24px rgba(0,0,0,.18); }
    .target { font-family: ui-monospace, Menlo, monospace; font-size: 13px; color: #6b6480;
              margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    textarea { width: 100%; min-height: 80px; resize: vertical; padding: 8px; color: #1f1a2e;
               background: #fff; border: 1px solid #c9c3d8; border-radius: 6px; }
    textarea:focus, button:focus-visible { outline: 2px solid #ff2d95; outline-offset: 1px; }
    .row { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
    .hint { margin-right: auto; font-size: 12px; color: #6b6480; }
    .row button { border: 0; border-radius: 6px; padding: 6px 12px; cursor: pointer; }
    .save { background: #ff2d95; color: #fff; }
    .cancel { background: #eeeaf5; color: #1f1a2e; }
    .marker { position: fixed; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 11px;
              background: #ff2d95; color: #fff; font-size: 12px; font-weight: 700;
              display: flex; align-items: center; justify-content: center;
              pointer-events: auto; box-shadow: 0 1px 4px rgba(0,0,0,.3); }
  `

  let hostEl, root, hl, pill, pop, ta, markers
  let active = false
  let target = null

  const label = (el) =>
    el.localName +
    (el.id ? '#' + el.id : '') +
    (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '')

  const inOverlay = (e) => hostEl && e.composedPath().includes(hostEl)

  function updatePill() {
    const n = window.__uiComments.list().length
    pill.textContent = (active ? 'Commenting' : 'Comment') + (n ? ` (${n})` : '')
  }

  function setActive(on) {
    active = on
    pill.classList.toggle('on', on)
    if (!on) {
      hl.hidden = true
      closePop()
    }
    updatePill()
  }

  function showHl(el) {
    const r = el.getBoundingClientRect()
    Object.assign(hl.style, {
      left: r.left - 2 + 'px',
      top: r.top - 2 + 'px',
      width: r.width + 4 + 'px',
      height: r.height + 4 + 'px',
    })
    hl.firstChild.textContent = label(el)
    hl.hidden = false
  }

  function openPop(el) {
    target = el
    showHl(el)
    const r = el.getBoundingClientRect()
    const w = 320,
      ph = 200
    const left = Math.min(Math.max(8, r.left), innerWidth - w - 8)
    const top = r.bottom + 8 + ph < innerHeight ? r.bottom + 8 : Math.max(8, r.top - ph - 8)
    Object.assign(pop.style, { left: left + 'px', top: top + 'px' })
    pop.querySelector('.target').textContent = label(el)
    ta.value = ''
    pop.hidden = false
    ta.focus()
  }

  function closePop() {
    pop.hidden = true
    target = null
  }

  function commit() {
    const text = ta.value.trim()
    if (!text || !target) return closePop()
    const list = load()
    const id = list.reduce((m, c) => Math.max(m, c.id), 0) + 1
    list.push({
      id,
      url: here(),
      comment: text,
      resolved: false,
      createdAt: new Date().toISOString(),
      element: describe(target),
    })
    closePop()
    save(list)
  }

  function render() {
    if (!root) return
    updatePill()
    markers.textContent = ''
    for (const c of window.__uiComments.list()) {
      if (c.url !== here()) continue
      let el = null
      try {
        el = document.querySelector(c.element.selector)
      } catch {}
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (r.bottom < 0 || r.top > innerHeight) continue
      const m = document.createElement('div')
      m.className = 'marker'
      m.textContent = c.id
      m.title = c.comment
      m.style.left = Math.max(0, r.right - 11) + 'px'
      m.style.top = Math.max(0, r.top - 11) + 'px'
      markers.appendChild(m)
    }
  }

  function mount() {
    hostEl = document.createElement('div')
    hostEl.id = '__ui-annotator'
    hostEl.style.cssText =
      'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647'
    root = hostEl.attachShadow({ mode: 'open' })
    root.innerHTML = `
      <style>${CSS_TEXT}</style>
      <div class="hl" hidden><span class="tag"></span></div>
      <div class="markers"></div>
      <div class="pop" hidden>
        <div class="target"></div>
        <textarea placeholder="What should change?"></textarea>
        <div class="row">
          <span class="hint">Enter to save, Shift+Enter for a new line</span>
          <button class="cancel" type="button">Cancel</button>
          <button class="save" type="button">Save comment</button>
        </div>
      </div>
      <button class="pill" type="button"></button>`
    hl = root.querySelector('.hl')
    markers = root.querySelector('.markers')
    pop = root.querySelector('.pop')
    ta = root.querySelector('textarea')
    pill = root.querySelector('.pill')

    pill.addEventListener('click', () => setActive(!active))
    root.querySelector('.save').addEventListener('click', commit)
    root.querySelector('.cancel').addEventListener('click', closePop)
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation() // keep page shortcuts from firing while typing
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        commit()
      } else if (e.key === 'Escape') closePop()
    })

    document.documentElement.appendChild(hostEl)
    render()

    // Re-attach if a framework wipes it; refresh markers for SPA route changes.
    setInterval(() => {
      if (!hostEl.isConnected) document.documentElement.appendChild(hostEl)
      render()
    }, 1000)
  }

  // ---------- page event interception (registered before page scripts) ----------

  const block = (e) => {
    if (!root || !active || e.shiftKey || inOverlay(e)) return
    e.preventDefault()
    e.stopImmediatePropagation()
  }
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick']) {
    addEventListener(type, block, true)
  }

  addEventListener(
    'click',
    (e) => {
      if (!root || !active || e.shiftKey || inOverlay(e)) return
      e.preventDefault()
      e.stopImmediatePropagation()
      openPop(e.target)
    },
    true,
  )

  addEventListener(
    'mousemove',
    (e) => {
      if (!root || !active || !pop.hidden || e.shiftKey || inOverlay(e)) return
      showHl(e.target)
    },
    true,
  )

  addEventListener(
    'keydown',
    (e) => {
      if (!root) return
      if (e.altKey && e.shiftKey && e.code === 'KeyC') {
        e.preventDefault()
        setActive(!active)
      } else if (e.key === 'Escape' && active && pop.hidden) {
        setActive(false)
      }
    },
    true,
  )

  let raf = 0
  const schedule = () => {
    if (!raf)
      raf = requestAnimationFrame(() => {
        raf = 0
        render()
      })
  }
  addEventListener('scroll', schedule, true)
  addEventListener('resize', schedule)

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true })
  } else {
    mount()
  }
})()
