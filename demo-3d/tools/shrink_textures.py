#!/usr/bin/env python3
"""Shrink the oversized textures inside the embedded model bundles (js/models_real.js, js/models_kids.js).

The game never shows a head or a hair texture big enough on screen to use 2048 px, so hair goes to 1024 px and
skin to 1536 px, re-encoded as WebP. Geometry, materials and everything else are left exactly as they are; only
image bufferViews change size, and the binary chunk is repacked around them. The original exports in models/
are not touched: re-run this after regenerating a bundle from them.

    python3 tools/shrink_textures.py js/models_real.js js/models_kids.js
"""
import base64, io, json, re, struct, sys
from PIL import Image

HAIR = re.compile(r'ponytail|short\d|braid|bob|hair|fringe', re.I)
SKIN = re.compile(r'skin|lightskinned|darkskinned|_diffuse$', re.I)


def target(name, size):
    m = max(size)
    if HAIR.search(name or ''): return min(m, 1024)
    if SKIN.search(name or ''): return min(m, 1536)
    return m


def shrink_glb(b):
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    bin_hdr = 20 + jl
    bl = struct.unpack('<I', b[bin_hdr:bin_hdr + 4])[0]
    binb = b[bin_hdr + 8:bin_hdr + 8 + bl]
    views = [binb[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in j['bufferViews']]
    report = []
    for im in j.get('images', []):
        vi = im['bufferView']
        src = Image.open(io.BytesIO(views[vi]))
        t = target(im.get('name'), src.size)
        if t >= max(src.size): continue
        k = t / max(src.size)
        out = src.convert('RGBA' if 'A' in src.getbands() else 'RGB').resize((round(src.size[0] * k), round(src.size[1] * k)), Image.LANCZOS)
        buf = io.BytesIO()
        out.save(buf, 'WEBP', quality=86, method=6, alpha_quality=90)
        new = buf.getvalue()
        if len(new) < len(views[vi]):
            report.append('%s %s->%s %dKB->%dKB' % (im.get('name'), src.size, out.size, len(views[vi]) // 1000, len(new) // 1000))
            views[vi] = new
            im['mimeType'] = 'image/webp'
    # Repack the binary chunk, 4-byte aligned, in the original order.
    parts, off = [], 0
    for v, data in zip(j['bufferViews'], views):
        pad = (-off) % 4
        if pad: parts.append(b'\0' * pad); off += pad
        v['byteOffset'] = off; v['byteLength'] = len(data)
        parts.append(data); off += len(data)
    pad = (-off) % 4
    if pad: parts.append(b'\0' * pad); off += pad
    j['buffers'][0]['byteLength'] = off
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    newbin = b''.join(parts)
    total = 12 + 8 + len(js) + 8 + len(newbin)
    out = struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(newbin), 0x004E4942) + newbin
    return out, report


def main(paths):
    for p in paths:
        s = open(p).read()
        def rep(m):
            raw = base64.b64decode(m.group(2))
            out, r = shrink_glb(raw)
            print(p, m.group(1), '%.2fMB -> %.2fMB' % (len(raw) / 1e6, len(out) / 1e6))
            for x in r: print('   ', x)
            return "%s: '%s'" % (m.group(1), base64.b64encode(out).decode())
        s2 = re.sub(r"(\w+):\s*'([A-Za-z0-9+/=]{1000,})'", rep, s)
        open(p, 'w').write(s2)


if __name__ == '__main__':
    main(sys.argv[1:])
