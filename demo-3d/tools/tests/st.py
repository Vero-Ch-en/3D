import os, sys, json
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/opt/pw-browsers'
from playwright.sync_api import sync_playwright
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots') + '/'
HELP = r"""
window.T = {
  // Run game time forward, answering dialogue (E) and choices (given list) as they come.
  async run(sec, choices = [], opts = {}) {
    const D = DEMO.STATE_DLG; let n = 0;
    for (let k = 0; k < sec * 30; k++) {
      DEMO.G.simT !== undefined;
      await DEMO.advance(1 / 30, 1 / 30);
      if (D.cur && D.t > 0.4) { D.shown = D.cur.text.length; DEMO.press('KeyE'); await DEMO.advance(1/30,1/30); DEMO.release('KeyE'); n++; }
      if (G.UI.modal === 'choices' && k % 10 === 0) { const c = choices.length ? choices.shift() : 1; await new Promise(r => setTimeout(r, 300)); dispatchEvent(new KeyboardEvent('keydown', { key: String(c), code: 'Digit' + c })); }
      if (G.UI.modal === 'minigame' && k % 9 === 0) dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE' }));
      if (opts.until && eval(opts.until)) break;
    }
    return { lines: n, ch: G.S.chapter, busy: G.busy(), modal: G.UI.modal, p: [DEMO.PLAYER.x.toFixed(2), DEMO.PLAYER.z.toFixed(2)], q: [DEMO.PARTNER.x.toFixed(2), DEMO.PARTNER.z.toFixed(2), DEMO.PARTNER.mode] };
  },
  // Walk the player toward (x, z) using real input keys relative to the camera.
  async walk(x, z, sec = 30) {
    const P = DEMO.PLAYER;
    for (let k = 0; k < sec * 30; k++) {
      const dx = x - P.x, dz = z - P.z; if (Math.hypot(dx, dz) < 0.12) break;
      const path = G.findPath(P.x, P.z, x, z); const w = path && path[0] ? path[0] : { x, z };
      const a = Math.atan2(w.x - P.x, w.z - P.z); P.yaw = a; DEMO.CAM.yaw = a + Math.PI;
      DEMO.keys.add('KeyW');
      await DEMO.advance(1 / 30, 1 / 30);
    }
    DEMO.keys.delete('KeyW');
    return [P.x.toFixed(2), P.z.toFixed(2)];
  },
};
"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': int(os.environ.get('W', 960)), 'height': int(os.environ.get('H', 540))}, has_touch=bool(os.environ.get('MOB')), is_mobile=bool(os.environ.get('MOB')))
    pg.set_default_timeout(900000)
    logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    if os.environ.get('CLEAR'): pg.add_init_script("try{localStorage.clear()}catch(e){}")
    if os.environ.get('INIT'): pg.add_init_script(os.environ['INIT'])
    if os.environ.get('CH'): pg.add_init_script("try{localStorage.setItem('cbs.base.save', JSON.stringify({v:1, chapter:'" + os.environ['CH'] + "', vars:{bond:0,trust:0,rivalry:0,fear:0}, mem:{hugs:0,holds:0,teases:0,kisses:0,fridge:0,foodStolen:0,foodShared:0,snacks:0,sitBeside:0,sitAcross:0,affection:0,partnerInit:0}, scrap:[], talked:{}, flags:{}}))}catch(e){}")
    pg.goto('http://localhost:' + os.environ.get('PORT', '8766') + '/index.html')
    pg.wait_for_function("document.getElementById('loading').classList.contains('done')")
    pg.evaluate(HELP)
    pg.evaluate("DEMO.setQ('" + os.environ.get('Q', 'High') + "')")
    for a in sys.argv[1:]:
        if a.startswith('SHOT:'):
            pg.wait_for_timeout(int(os.environ.get('SW', 2500))); pg.screenshot(path=OUT + a[5:] + '.png'); continue
        if a.startswith('WAIT:'):
            pg.wait_for_timeout(int(a[5:])); continue
        r = pg.evaluate(a)
        if r is not None: print('>>', json.dumps(r)[:1500])
    print('\n'.join(l for l in logs if 'TUNNEL' not in l and 'fonts.g' not in l and '404' not in l)[:4000])
    b.close()
