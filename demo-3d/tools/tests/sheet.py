#!/usr/bin/env python3
"""Scene sheet: play every chapter, capture a frame at each new line of dialogue or choice, and build one page
with a grid per chapter (speaker and line under each frame), to skim for anything that looks off.

    cd demo-3d && python3 -m http.server 8766 &
    python3 tools/tests/sheet.py out.html            # every chapter
    CHAPTERS=morning,evening python3 tools/tests/sheet.py out.html
Env: PER (frames per chapter, default 14), W/H (viewport, default 960x540), Q (quality preset, default High).
Needs Playwright with Chromium, and Pillow.
"""
import base64, html, io, json, os, sys
from PIL import Image
from playwright.sync_api import sync_playwright

PORT = os.environ.get('PORT', '8766')
PER = int(os.environ.get('PER', 14))
W, H = int(os.environ.get('W', 960)), int(os.environ.get('H', 540))

# Advance until something new is on screen: a new line (fully shown), a choice, or nothing for a while.
NEXT = r"""async ([last, secs]) => {
  const D = G.DLG;
  for (let k = 0; k < 30 * secs; k++) {
    await DEMO.advance(1 / 30, 1 / 30);
    if (G.UI.modal === 'choices') { const o = [...document.querySelectorAll('#choices button')].map((b) => b.innerText.replace(/^\d\s*/, '').trim()); if (o.join('|') !== last) return { kind: 'choice', text: o.join('  /  '), key: o.join('|'), ch: G.S.chapter }; }
    if (G.UI.modal === 'minigame' && k % 9 === 0) dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE' }));
    if (D.cur && D.cur.text !== last && D.t > 0.6) { D.shown = D.cur.text.length; for (let i = 0; i < 6; i++) await DEMO.advance(1 / 30, 1 / 30); return { kind: 'line', who: D.cur.who || '', text: D.cur.text, key: D.cur.text, ch: G.S.chapter }; }
  }
  return { kind: 'idle', ch: G.S.chapter, key: '' };
}"""
STEP = r"""(kind) => {
  if (kind === 'line') { G.DLG.shown = 1e9; DEMO.press('KeyE'); setTimeout(() => DEMO.release('KeyE'), 0); }
  if (kind === 'choice') dispatchEvent(new KeyboardEvent('keydown', { key: '1', code: 'Digit1' }));
}"""


def main(out):
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = b.new_page(viewport={'width': W, 'height': H})
        pg.set_default_timeout(900000)
        pg.add_init_script("try{localStorage.clear()}catch(e){}; window.SKIP_DAWN=1;")
        pg.goto('http://localhost:%s/index.html' % PORT)
        pg.wait_for_function("document.getElementById('loading').classList.contains('done')")
        pg.evaluate("DEMO.setQ('%s')" % os.environ.get('Q', 'High'))
        pg.evaluate("document.getElementById('title').classList.add('hide')")
        chapters = pg.evaluate("G.CHAPTERS.map(([id, t]) => [id, t])")
        want = [c for c in os.environ.get('CHAPTERS', '').split(',') if c]
        if want: chapters = [c for c in chapters if c[0] in want]
        sheet = []
        cache = os.environ.get('CACHE', out + '.cache')
        os.makedirs(cache, exist_ok=True)
        for cid, title in chapters:
            cf = os.path.join(cache, cid + '.json')
            if os.path.exists(cf) and not os.environ.get('FRESH'):   # resume: chapters already captured
                sheet.append((cid, title, json.load(open(cf)))); write(out, sheet); continue
            print('==', cid, flush=True)
            pg.evaluate("async (id) => { let done = false; G.jumpTo(id).then(() => { done = true; }); for (let k = 0; k < 300 && !done; k++) await DEMO.advance(1 / 30, 1 / 30); }", cid)
            frames, last, idle = [], '', 0
            while len(frames) < PER:
                r = pg.evaluate(NEXT, [last, 45 if not frames else 14])
                if r['kind'] == 'idle':   # free time (the player has to do something): one frame of it, then the next chapter
                    frames.append(shot(pg, '(free time: the chapter waits for you here)', ''))
                    break
                idle = 0
                if r.get('ch') != cid and not r['ch'].startswith(cid[:4]): break   # the chapter moved on
                pg.wait_for_timeout(350)   # let the subtitle fade in
                who = {'partner': 'Partner', 'player': 'You', '': ''}.get(r.get('who', ''), r.get('who', ''))
                frames.append(shot(pg, r['text'] if r['kind'] == 'line' else 'Choice: ' + r['text'], who))
                last = r['key']
                pg.evaluate(STEP, r['kind'])
            sheet.append((cid, title, frames))
            json.dump(frames, open(cf, 'w')); write(out, sheet)   # keep what we have, chapter by chapter
        b.close()
    write(out, sheet)


def shot(pg, text, who):
    png = pg.screenshot(type='jpeg', quality=80)
    im = Image.open(io.BytesIO(png)).convert('RGB')
    im = im.resize((480, round(480 * im.size[1] / im.size[0])), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=62, optimize=True)
    return {'src': 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode(), 'text': text, 'who': who}


def write(out, sheet):
    n = sum(len(f) for _, _, f in sheet)
    nav = ''.join('<a href="#%s">%s <span>%d</span></a>' % (c, html.escape(t), len(f)) for c, t, f in sheet)
    secs = []
    for c, t, frames in sheet:
        cells = ''.join('<figure><img loading="lazy" src="%s" alt=""><figcaption><b>%s</b>%s</figcaption></figure>' % (f['src'], html.escape(f['who']) + (' · ' if f['who'] else ''), html.escape(f['text'])) for f in frames)
        secs.append('<section id="%s"><h2>%s <small>%s</small></h2><div class="grid">%s</div></section>' % (c, html.escape(t), c, cells))
    page = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scene Sheet</title><style>
:root { --bg: #f6f4f0; --ink: #1d1b19; --dim: #6b655e; --card: #fff; --line: #e4dfd7; --accent: #b66a2c; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #121417; --ink: #ece9e4; --dim: #9a948c; --card: #1b1e22; --line: #2a2e33; --accent: #e3a061; } }
:root[data-theme="dark"] { --bg: #121417; --ink: #ece9e4; --dim: #9a948c; --card: #1b1e22; --line: #2a2e33; --accent: #e3a061; }
* { box-sizing: border-box; } body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.45 system-ui, -apple-system, Segoe UI, sans-serif; }
header { padding: 28px 16px 8px; max-width: 1400px; margin: 0 auto; } h1 { font: 600 26px/1.2 Georgia, serif; margin: 0 0 4px; } header p { margin: 0; color: var(--dim); }
nav { position: sticky; top: 0; z-index: 2; background: var(--bg); border-bottom: 1px solid var(--line); padding: 10px 16px; display: flex; gap: 6px; overflow-x: auto; }
nav a { white-space: nowrap; color: var(--ink); text-decoration: none; padding: 5px 10px; border: 1px solid var(--line); border-radius: 999px; font-size: 13px; }
nav a span { color: var(--dim); margin-left: 3px; } nav a:hover { border-color: var(--accent); }
section { max-width: 1400px; margin: 0 auto; padding: 18px 16px 6px; } h2 { font: 600 19px/1.2 Georgia, serif; margin: 0 0 10px; } h2 small { font: 12px ui-monospace, monospace; color: var(--dim); margin-left: 6px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
figure { margin: 0; background: var(--card); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
figure img { display: block; width: 100%; height: auto; } figcaption { padding: 8px 10px 10px; font-size: 13px; color: var(--ink); } figcaption b { color: var(--accent); font-weight: 600; }
</style></head><body><header><h1>Scene Sheet</h1><p>""" + str(n) + """ frames across """ + str(len(sheet)) + """ chapters: one at each new line of dialogue or choice, played with the first answer each time.</p></header>
<nav>""" + nav + "</nav>" + ''.join(secs) + "</body></html>"
    open(out, 'w').write(page)
    print('wrote', out, '%.1f MB' % (len(page) / 1e6), n, 'frames')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'scene-sheet.html')
