# Frame strips of character motion: each scenario = setup JS, then frames advanced by dt seconds each.
import os, sys, json
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/opt/pw-browsers'
from playwright.sync_api import sync_playwright
from PIL import Image
OUT = '/tmp/claude-0/-home-claude/253aaa62-684a-5c04-8965-25e77ede94c8/scratchpad/shots/'
HELP = open('st.py').read().split('HELP = r"""')[1].split('"""')[0]
scen = json.load(open(sys.argv[1]))
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 640, 'height': 420})
    pg.set_default_timeout(900000)
    pg.add_init_script("try{localStorage.clear()}catch(e){}")
    pg.goto('http://localhost:8766/index.html')
    pg.wait_for_function("document.getElementById('loading').classList.contains('done')")
    pg.evaluate(HELP); pg.evaluate("DEMO.setQ('High')")
    pg.evaluate("window.adv=async(s)=>{for(let k=0;k<Math.round(s*30);k++) await DEMO.advance(1/30,1/30);}; window.shot=(x,y,z,lx,ly,lz,f)=>{G.setShot(G.SAPI.fixed(G.SAPI.V(x,y,z),G.SAPI.V(lx,ly,lz),f||40,0.004)); DEMO.STATE.sceneShot=true;};")
    for sc in scen:
        r = pg.evaluate(sc['setup']); print(sc['name'], r)
        imgs = []
        for i in range(sc['n']):
            if sc.get('step'): pg.evaluate(sc['step'].replace('$i', str(i)))
            pg.evaluate(f"adv({sc['dt']})")
            f = OUT + f"fr_{sc['name']}_{i}.png"; pg.screenshot(path=f); imgs.append(Image.open(f).crop(tuple(sc.get('crop', [0, 0, 640, 420]))))
        w, h = imgs[0].size; cols = sc.get('cols', 4); rows = (len(imgs) + cols - 1) // cols
        sheet = Image.new('RGB', (w * cols, h * rows))
        for i, im in enumerate(imgs): sheet.paste(im, ((i % cols) * w, (i // cols) * h))
        sheet.save(OUT + f"sheet_{sc['name']}.png")
    b.close()
