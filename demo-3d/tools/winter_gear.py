"""Knitted beanies and wrapped scarves for the realistic characters (run in Blender after tools/overcoat.py, on
cozy_characters_overcoats.blend; build 59). Each is built round the character's own head and coat:

  hat_<name>:   a beanie shaped on the skull (rays from the middle of the head; up to 2.5 cm of hair under it),
                its brim just above the brows, over the tops of the ears and low at the back, with a turned-up
                cuff; hers has a bobble. UVs run round the head (ribs) and up it (rows of stitches).
                Skinned to the head.
  scarf_<name>: wrapped twice round the neck on the coat's collar, crossing at the front, with two ends hanging
                down the chest over the coat (one longer). Loop skinned to neck and chest; the ends take the coat's
                own weights under them.

Load as a text block in pieces (as overcoat.py), exec it in the same namespace as overcoat.py, then build_gear().
export() in overcoat.py exports any object; the game's tools/patch_overcoat.js adds hat_/scarf_ as skinned meshes."""
import bpy, bmesh, math
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree
from mathutils.interpolate import poly_3d_calc

HAT_STYLE = {'player': dict(bobble=False, cuff=0.044, slouch=0.008, lift=0.012, back=0.035), 'partner': dict(bobble=True, cuff=0.05, slouch=0.014, lift=0.0, back=0.0)}


def head_info(n):
    rest(n); h = bpy.data.objects['human_' + n]; G = {g.index: g.name for g in h.vertex_groups}; mw = h.matrix_world
    head = [mw @ v.co for v in h.data.vertices if v.groups and G[max(v.groups, key=lambda g: g.weight).group] == 'mixamorig:Head']
    hb = J(n, 'Head'); top = max(p.z for p in head)
    brow = next(o for o in bpy.data.objects if o.name.startswith('human_' + n + '.eyebrow'))
    bz = max((brow.matrix_world @ v.co).z for v in brow.data.vertices)
    up = [p for p in head if p.z > hb.z + 0.05]
    C = Vector((hb.x, (min(p.y for p in up) + max(p.y for p in up)) / 2, (bz + top) / 2 - 0.01))
    V = [mw @ v.co for v in h.data.vertices]; F = [list(p.vertices) for p in h.data.polygons]
    skull = BVHTree.FromPolygons(V, F)
    hv = []; hf = []
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.parent == h and any(k in o.name for k in ('ponytail', 'short', 'fringe')):
            off = len(hv); hv += [o.matrix_world @ v.co for v in o.data.vertices]; hf += [[off + i for i in p.vertices] for p in o.data.polygons]
    hair = BVHTree.FromPolygons(hv, hf) if hf else None
    return dict(C=C, hb=hb, top=top, brow=bz, skull=skull, hair=hair)


def radius(tree, C, d, far=0.4):
    hit = tree.ray_cast(C + d * far, -d, far)
    return (hit[0] - C).length if hit[0] is not None else None


def build_hat(n, NT=48, NR=14):
    st = HAT_STYLE[n]; I = head_info(n); C = I['C']; s = land(n)['s']
    zf = I['brow'] + (0.016 + st.get('lift', 0)) * s; zb = I['hb'].z + (0.03 + st.get('back', 0)) * s   # his sits higher: over the tops of the ears, not down over them
    def zbrim(th):
        return zb + (zf - zb) * (0.5 + 0.5 * math.cos(th))
    def dirn(th, e): return Vector((math.sin(th) * math.cos(e), -math.cos(th) * math.cos(e), math.sin(e)))
    rows = []
    for k in range(NR + 1):
        row = []
        for j in range(NT):
            th = 2 * math.pi * j / NT
            rh = radius(I['skull'], Vector((C.x, C.y, zbrim(th))), Vector((math.sin(th), -math.cos(th), 0))) or 0.09
            e0 = math.atan2(zbrim(th) - C.z, rh)
            t = k / NR; e = e0 + (math.pi / 2 - e0) * (t ** 0.9)
            d = dirn(th, e)
            rs = radius(I['skull'], C, d) or 0.095
            rhair = radius(I['hair'], C, d) if I['hair'] else None
            r = rs + 0.012
            if rhair: r = max(r, min(rhair, rs + 0.025) + 0.004)
            r += st['slouch'] * (t ** 2)
            row.append([th, e, r])
        rows.append(row)
    for _ in range(6):
        new = [[x[:] for x in row] for row in rows]
        for k in range(NR + 1):
            for j in range(NT):
                nb = [rows[k][(j - 1) % NT][2], rows[k][(j + 1) % NT][2]] + ([rows[k - 1][j][2]] if k > 0 else []) + ([rows[k + 1][j][2]] if k < NR else [])
                new[k][j][2] = max(rows[k][j][2] * 0.5 + sum(nb) / len(nb) * 0.5, rows[k][j][2] - 0.003)
        rows = new
    P = [[C + dirn(th, e) * r for th, e, r in row] for row in rows]
    topc = C + Vector((0, 0, 1)) * max(x[2] for x in rows[NR]) * 1.0
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    grid = [[bm.verts.new(p) for p in row] for row in P[:-1]]
    apex = bm.verts.new(topc)
    def uvq(k, j): return (3.0 * j / NT, k / NR * 1.6)
    def face(vs, uvs):
        try: f = bm.faces.new(vs)
        except ValueError: return None
        for l, uv in zip(f.loops, uvs): l[uvl].uv = uv
        return f
    for k in range(NR - 1):
        for j in range(NT):
            j2 = (j + 1) % NT; u2 = 3.0 * (j + 1) / NT
            face([grid[k][j], grid[k][j2], grid[k + 1][j2], grid[k + 1][j]], [uvq(k, j), (u2, k / NR * 1.6), (u2, (k + 1) / NR * 1.6), uvq(k + 1, j)])
    for j in range(NT):
        j2 = (j + 1) % NT
        face([grid[NR - 1][j], grid[NR - 1][j2], apex], [uvq(NR - 1, j), (3.0 * (j + 1) / NT, (NR - 1) / NR * 1.6), (3.0 * (j + 0.5) / NT, 1.6)])
    cuffH = st['cuff'] * s; ringsC = []
    for frac, off in ((0.0, 0.0035), (0.0, 0.0085), (0.5, 0.0095), (1.0, 0.0085), (1.0, 0.0035)):
        ring = []
        for j in range(NT):
            pts = [P[k][j] for k in range(NR + 1)]; acc = 0.0; want = frac * cuffH; q = pts[0]; nrm = (pts[0] - C).normalized()
            for a, b in zip(pts, pts[1:]):
                L = (b - a).length
                if acc + L >= want: q = a.lerp(b, (want - acc) / L if L else 0); nrm = (q - C).normalized(); break
                acc += L
            ring.append(q + nrm * off)
        ringsC.append([bm.verts.new(p) for p in ring])
    vC = [0.0, 0.02, 0.5, 0.98, 1.0]
    for a in range(len(ringsC) - 1):
        for j in range(NT):
            j2 = (j + 1) % NT; u = 3.0 * j / NT; u2 = 3.0 * (j + 1) / NT
            face([ringsC[a][j], ringsC[a + 1][j], ringsC[a + 1][j2], ringsC[a][j2]], [(u, vC[a]), (u, vC[a + 1]), (u2, vC[a + 1]), (u2, vC[a])])
    for j in range(NT):
        j2 = (j + 1) % NT; u = 3.0 * j / NT; u2 = 3.0 * (j + 1) / NT
        face([grid[0][j2], ringsC[0][j2], ringsC[0][j], grid[0][j]], [(u2, 0), (u2, 0), (u, 0), (u, 0)])
    if st['bobble']:
        R = 0.042 * s; cen = topc + Vector((0, 0, R * 0.75)); seg = 16; rings = 10; vs = []
        for a in range(rings + 1):
            ph = math.pi * a / rings; row = []
            for b in range(seg):
                be = 2 * math.pi * b / seg; d = Vector((math.sin(ph) * math.cos(be), math.sin(ph) * math.sin(be), math.cos(ph)))
                fz = 1 + 0.12 * noise.noise(d * 6.0) + 0.06 * noise.noise(d * 15.0)
                row.append(bm.verts.new(cen + d * R * fz))
            vs.append(row)
        for a in range(rings):
            for b in range(seg):
                b2 = (b + 1) % seg
                face([vs[a][b], vs[a + 1][b], vs[a + 1][b2], vs[a][b2]], [(b / seg * 2, a / rings), (b / seg * 2, (a + 1) / rings), ((b + 1) / seg * 2, (a + 1) / rings), ((b + 1) / seg * 2, a / rings)])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish_gear(n, 'hat_' + n, bm, {'mixamorig:Head': 1.0})


def finish_gear(n, name, bm, weights=None, per_vertex=None):
    old = bpy.data.objects.get(name)
    if old: bpy.data.objects.remove(old, do_unlink=True)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    h = bpy.data.objects['human_' + n]; ob.parent = h; ob.matrix_parent_inverse = h.matrix_world.inverted()
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for d in ca.data: d.color = (1, 1, 1, 1)
    for k in (weights or {}): ob.vertex_groups.new(name=k)
    if weights:
        for k, w in weights.items(): ob.vertex_groups[k].add(list(range(len(me.vertices))), w, 'REPLACE')
    if per_vertex:
        for i, ws in enumerate(per_vertex):
            for k, w in ws.items():
                if w > 1e-3: (ob.vertex_groups.get(k) or ob.vertex_groups.new(name=k)).add([i], w, 'REPLACE')
    m = ob.modifiers.new('Armature', 'ARMATURE'); m.object = rig(n)
    ob.color = (0.9, 0.8, 0.3, 1)
    return ob


def coat_surface(n):
    rest(n); V = []; F = []; W = []
    for o in (coat(n), bpy.data.objects['coatdetail_' + n]):
        G = {g.index: g.name for g in o.vertex_groups}; off = len(V); mw = o.matrix_world
        V += [mw @ v.co for v in o.data.vertices]; W += [{G[g.group]: g.weight for g in v.groups} for v in o.data.vertices]
        F += [[off + i for i in p.vertices] for p in o.data.polygons]
    return BVHTree.FromPolygons(V, F), V, F, W


def ribbon(bm, uvl, per, rows_c, lat_of, nor_of, width, thick, ws_of, vscale):
    """A flat knitted strip: rows_c = centre points down its length; across it `width`, out of the coat `thick`."""
    nc = 6; R = []
    for a, c in enumerate(rows_c):
        lat = lat_of(a); nrm = nor_of(a); ring = []
        for side_off in (thick * 0.5, -thick * 0.5):
            for i in range(nc):
                u = (i / (nc - 1) - 0.5) * width
                p = c + lat * u + nrm * side_off
                ring.append(bm.verts.new(p)); per.append(ws_of(c))
        R.append(ring)
    acc = [0.0]
    for a in range(1, len(rows_c)): acc.append(acc[-1] + (rows_c[a] - rows_c[a - 1]).length)
    def f(vs, uvs):
        try:
            ff = bm.faces.new(vs)
            for l, uv in zip(ff.loops, uvs): l[uvl].uv = uv
        except ValueError: pass
    for a in range(len(R) - 1):
        v1, v2 = acc[a] / vscale, acc[a + 1] / vscale
        for i in range(nc - 1):
            u1, u2 = i / (nc - 1), (i + 1) / (nc - 1)
            f([R[a][i], R[a][i + 1], R[a + 1][i + 1], R[a + 1][i]], [(u1, v1), (u2, v1), (u2, v2), (u1, v2)])            # front
            f([R[a][nc + i + 1], R[a][nc + i], R[a + 1][nc + i], R[a + 1][nc + i + 1]], [(u2, v1), (u1, v1), (u1, v2), (u2, v2)])  # back
        for e0, e1 in ((0, nc), (nc - 1, 2 * nc - 1)):   # the two long edges
            f([R[a][e1], R[a][e0], R[a + 1][e0], R[a + 1][e1]], [(0, v1), (0.05, v1), (0.05, v2), (0, v2)])
    for a in (0, len(R) - 1):   # the cut ends
        ring = R[a]
        for i in range(nc - 1):
            f([ring[i], ring[nc + i], ring[nc + i + 1], ring[i + 1]], [(0, 0)] * 4)


def build_scarf(n, NT=40, wide=0.058, thick=0.02):
    rest(n); L = land(n); s = L['s']; neck = J(n, 'Neck')
    tree, V, F, W = coat_surface(n)
    cm = coat(n); body = BVHTree.FromPolygons([cm.matrix_world @ v.co for v in cm.data.vertices], [list(p.vertices) for p in cm.data.polygons])
    h = bpy.data.objects['human_' + n]; hmw = h.matrix_world
    G = {g.index: g.name for g in h.vertex_groups}
    neckpts = [hmw @ v.co for v in h.data.vertices if v.groups and G[max(v.groups, key=lambda g: g.weight).group] == 'mixamorig:Neck']
    rN = sum(math.hypot(p.x - neck.x, p.y - neck.y) for p in neckpts) / max(1, len(neckpts))
    cx, cy = neck.x, sum(p.y for p in neckpts) / max(1, len(neckpts))
    z0 = L['zN'] + 0.004 * s
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); per = []
    def coatw(c):
        loc, nor, fi, d = tree.find_nearest(c); ids = F[fi]; bw = poly_3d_calc([V[i] for i in ids], loc); acc = {}
        for i, b in zip(ids, bw):
            for kk, x in W[i].items(): acc[kk] = acc.get(kk, 0) + x * b
        t = sum(acc.values()) or 1; return {kk: x / t for kk, x in acc.items()}
    def loopw(c):
        f = max(0.0, min(1.0, (c.z - (z0 - 0.03)) / 0.08))
        return {'mixamorig:Neck': 0.4 * f, 'mixamorig:Spine2': 1 - 0.4 * f}
    # two wraps round the neck, lying on the collar (the lower one dips at the front where the ends come out)
    for wrap, (dz, dr, dip) in enumerate(((0.01, 0.0, 0.012), (-0.022, 0.012, 0.03))):
        cs = []; outs = []
        for j in range(NT + 1):
            th = 2 * math.pi * j / NT; out = Vector((math.sin(th), -math.cos(th), 0)); front = 0.5 + 0.5 * math.cos(th)
            z = z0 + dz * s - dip * s * front ** 2
            c = Vector((cx, cy, z)) + out * (rN + thick * 0.5 + 0.016 * s + dr * s + 0.008 * s * front)
            loc, nor, fi, d = tree.find_nearest(c)
            if loc is not None and (c - loc).dot(nor) < thick * 0.6: c = loc + nor * (thick * 0.6 + 0.002)
            cs.append(c); outs.append(out)
        # a ribbon whose "width" runs up and down the neck
        ribbon(bm, uvl, per, cs, lambda a: Vector((0, 0, 1)), lambda a: outs[a], wide * s, thick * s, loopw, 0.12)
    # two ends hanging down the chest, a little to the wearer's left, lying flat on the coat
    side = 1 if J(n, 'LeftArm').x > L['cx'] else -1
    for k, (Lk, dx, lift) in enumerate(((0.40, 0.03, 0.0), (0.31, 0.065, 0.006))):
        cs = []; nors = []; steps = 16
        for a in range(steps + 1):
            t = a / steps
            x = cx + side * (dx + 0.012 * math.sin(t * 2.4 + k)) * s; z = z0 - 0.015 * s - Lk * s * t
            hit = body.ray_cast(Vector((x, cy - 0.6, z)), Vector((0, 1, 0)))     # the coat itself, not its lapels
            if hit[0] is None: continue
            nrm = hit[1] if hit[1].y < 0 else -hit[1]
            cs.append(hit[0]); nors.append(nrm)
        for _ in range(4):   # smooth path and normals, so the end hangs in one easy line
            cs = [cs[0]] + [(cs[a - 1] + cs[a] * 2 + cs[a + 1]) / 4 for a in range(1, len(cs) - 1)] + [cs[-1]]
            nors = [nors[0]] + [(nors[a - 1] + nors[a] * 2 + nors[a + 1]).normalized() for a in range(1, len(nors) - 1)] + [nors[-1]]
        cs = [c + nrm * (thick * 0.5 * s + 0.004 + lift) for c, nrm in zip(cs, nors)]
        for a in range(len(cs)):   # and clear of the lapels and buttons on top of the coat
            for _ in range(3):
                loc, nor, fi, d = tree.find_nearest(cs[a])
                if loc is None: break
                gap = (cs[a] - loc).dot(nors[a])
                if gap < thick * 0.5 * s + 0.002: cs[a] = cs[a] + nors[a] * (thick * 0.5 * s + 0.002 - gap)
                else: break
        def lat(a):
            dn = (cs[min(a + 1, len(cs) - 1)] - cs[max(a - 1, 0)]).normalized()
            return dn.cross(nors[a]).normalized()
        ribbon(bm, uvl, per, cs, lat, lambda a: nors[a], 0.13 * s, thick * 0.8 * s, coatw, 0.12)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish_gear(n, 'scarf_' + n, bm, per_vertex=per)


def finish_shell(n, name, bm, per, cols, smooth=2):
    uvl = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        nrm = f.normal; ax = max(range(3), key=lambda a: abs(nrm[a]))
        for l in f.loops:
            p = l.vert.co; l[uvl].uv = [(p.y, p.z), (p.x, p.z), (p.x, p.y)][ax][0] / 0.08, [(p.y, p.z), (p.x, p.z), (p.x, p.y)][ax][1] / 0.08
    for _ in range(smooth):
        bmesh.ops.smooth_vert(bm, verts=[v for v in bm.verts if not v.is_boundary], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = finish_gear(n, name, bm, per_vertex=per)
    ca = ob.data.color_attributes['Col']
    for i, c in enumerate(cols): ca.data[i].color = (c[0], c[1], c[2], 1)
    return ob



def skin_shell(n, name, pick, offset_of, colour_of=None, centre=None):
    """A layer over part of the body: the body's own faces where pick() holds, pushed outward (away from `centre`,
    whatever way the skin's normals face) by offset_of(), keeping the body's weights so it bends as the body does."""
    rest(n); h = bpy.data.objects['human_' + n]; mw = h.matrix_world; nm = mw.to_3x3()
    G = {g.index: g.name for g in h.vertex_groups}; me = h.data
    sel = {}
    for v in me.vertices:
        ws = {G[g.group]: g.weight for g in v.groups if g.weight > 1e-3}
        if ws and pick(mw @ v.co, ws): sel[v.index] = ws
    sgn = 1.0
    if centre is not None and sel:
        dots = [((nm @ me.vertices[i].normal).normalized()).dot((mw @ me.vertices[i].co) - centre(mw @ me.vertices[i].co)) for i in sel]
        sgn = 1.0 if sum(dots) >= 0 else -1.0
    bm = bmesh.new(); idx = {}; per = []; cols = []
    for v in me.vertices:
        if v.index in sel:
            p = mw @ v.co; nrm = (nm @ v.normal).normalized() * sgn; ws = sel[v.index]
            idx[v.index] = bm.verts.new(p + nrm * offset_of(p, ws)); per.append(ws)
            cols.append(colour_of(p, ws) if colour_of else (1, 1, 1))
    for f in me.polygons:
        if all(i in idx for i in f.vertices):
            try: bm.faces.new([idx[i] for i in f.vertices])
            except ValueError: pass
    bm.verts.ensure_lookup_table()
    return bm, per, cols


def build_gloves(n):
    """Knitted gloves: over the hands and fingers (3 mm), with a ribbed cuff (7 mm) up the wrist under the sleeve."""
    rest(n); out = []
    for side in ('Left', 'Right'):
        H = J(n, side + 'Hand'); E = J(n, side + 'ForeArm'); up = (E - H).normalized()
        def handish(ws): return sum(w for k, w in ws.items() if side + 'Hand' in k) / (sum(ws.values()) or 1)
        def pick(p, ws, H=H, up=up):
            a = (p - H).dot(up)
            return handish(ws) > 0.5 or (-0.01 < a < 0.13 and sum(w for k, w in ws.items() if side + 'ForeArm' in k or side + 'Hand' in k) > 0.6)
        def off(p, ws, H=H, up=up):
            a = (p - H).dot(up); th = sum(w for k, w in ws.items() if 'Thumb1' in k or 'Thumb2' in k)
            return 0.003 + 0.005 * max(0.0, min(1.0, (a + 0.005) / 0.03)) + 0.003 * min(1.0, th * 2)   # a little more round the base of the thumb, which bulges when it bends
        tip = H - up * 0.09
        def centre(p, H=H, tip=tip):
            from mathutils.geometry import intersect_point_line
            q, t = intersect_point_line(p, H + (H - tip) * 0.5, tip); t = max(0.0, min(1.0, t)); return (H + (H - tip) * 0.5).lerp(tip, t)
        bm, per, cols = skin_shell(n, 'glove', pick, off, centre=centre)
        out.append((bm, per, cols))
    bm = bmesh.new(); per = []; cols = []
    for b2, p2, c2 in out:
        me = bpy.data.meshes.new('_tmp'); b2.to_mesh(me); b2.free(); bm.from_mesh(me); bpy.data.meshes.remove(me); per += p2; cols += c2
    return finish_shell(n, 'gloves_' + n, bm, per, cols, smooth=1)


def hull2(pts):
    pts = sorted(set((round(p[0], 5), round(p[1], 5)) for p in pts))
    if len(pts) < 3: return pts
    cr = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo = []; hi = []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cr(hi[-2], hi[-1], p) <= 0: hi.pop()
        hi.append(p)
    return lo[:-1] + hi[:-1]


def ray_hull(h, c, ang):
    """Distance from c to the hull polygon h along angle ang."""
    d = (math.cos(ang), math.sin(ang)); best = None
    for i in range(len(h)):
        a = h[i]; b = h[(i + 1) % len(h)]
        ex, ey = b[0] - a[0], b[1] - a[1]; den = d[0] * ey - d[1] * ex
        if abs(den) < 1e-12: continue
        t = ((a[0] - c[0]) * ey - (a[1] - c[1]) * ex) / den; u = ((a[0] - c[0]) * d[1] - (a[1] - c[1]) * d[0]) / den
        if t > 0 and -1e-6 <= u <= 1 + 1e-6: best = t if best is None else min(best, t)
    return best or 0.03


def build_boots(n, NA=36, NZ=16):
    """Winter boots built in horizontal slices round each foot and lower leg (the outline of the foot, sock and
    legging in each slice, eased out), a flat sole a little wider than the foot, the shaft to mid-calf; skinned from
    the nearest body point (foot, toes, shin). His dark leather, hers tan suede with a fleece cuff."""
    from mathutils import kdtree
    rest(n); st = BOOT_STYLE[n]; s = land(n)['s']
    pts = []; ws = []
    for nm in ('human_' + n, 'socks_' + n, 'leggings_' + n):
        o = bpy.data.objects.get(nm)
        if not o: continue
        G = {g.index: g.name for g in o.vertex_groups}; mw = o.matrix_world
        for v in o.data.vertices:
            w = {G[g.group]: g.weight for g in v.groups if g.weight > 1e-3 and g.group in G}
            low = sum(x for k, x in w.items() if k.endswith(('Foot', 'ToeBase')) or (k.endswith('Leg') and 'UpLeg' not in k))
            if w and low / (sum(w.values()) or 1) > 0.6: pts.append(mw @ v.co); ws.append(w)
    fz = min(p.z for p in pts); top = fz + st['shaft'] * s; floor = fz - 0.018 * s
    LV = []; LF = []
    for nm in ('human_' + n, 'socks_' + n, 'leggings_' + n):
        o = bpy.data.objects.get(nm)
        if not o: continue
        off = len(LV); LV += [o.matrix_world @ v.co for v in o.data.vertices]; LF += [[off + i for i in p.vertices] for p in o.data.polygons]
    legs = BVHTree.FromPolygons(LV, LF)
    kd = kdtree.KDTree(len(pts))
    for i, p in enumerate(pts): kd.insert(p, i)
    kd.balance()
    bm = bmesh.new(); per = []; cols = []
    for side in ('Left', 'Right'):
        F = J(n, side + 'Foot'); Lg = J(n, side + 'Leg')
        mine = [p for p in pts if (p - F).length < (p - J(n, ('Right' if side == 'Left' else 'Left') + 'Foot')).length]
        zs = [floor] + [fz + (top - fz) * (k / (NZ - 1)) ** 1.25 for k in range(NZ)]
        rings = []
        for k, z in enumerate(zs):
            zz = max(z, fz + 0.004)
            band = [p for p in mine if abs(p.z - zz) < 0.012 + 0.01 * (k < 4)]
            if k <= 1: band = [p for p in mine if p.z < fz + 0.03]          # the sole: the whole footprint
            if len(band) < 3: band = [p for p in mine if abs(p.z - zz) < 0.03]
            h = hull2([(p.x, p.y) for p in band]); c = (sum(p[0] for p in h) / len(h), sum(p[1] for p in h) / len(h))
            ease = 0.010 if zz < fz + 0.08 else 0.009
            if k <= 1: ease = 0.011
            if st['cuff'] and z > top - 0.035 * s: ease += 0.006
            ring = []
            for a in range(NA):
                ang = 2 * math.pi * a / NA; r = ray_hull(h, c, ang)
                # and never inside the leg itself: a ray in from 12 cm out, at this height
                d = Vector((math.cos(ang), math.sin(ang), 0)); o0 = Vector((c[0], c[1], zz)) + d * 0.12
                hit = legs.ray_cast(o0, -d, 0.12)
                if hit[0] is not None: r = max(r, (Vector((hit[0].x, hit[0].y)) - Vector(c)).length)
                r += ease
                p = Vector((c[0] + math.cos(ang) * r, c[1] + math.sin(ang) * r, z))
                ring.append(p)
            rings.append(ring)
        # smooth each ring and between rings so the boot reads as one shape
        for _ in range(3):
            rings = [[(r[(a - 1) % NA] + r[a] * 2 + r[(a + 1) % NA]) / 4 for a in range(NA)] for r in rings]
        vs = []
        for k, ring in enumerate(rings):
            row = []
            for p in ring:
                v = bm.verts.new(p); row.append(v)
                _, i, _ = kd.find(Vector((p.x, p.y, max(p.z, fz + 0.01)))); per.append(ws[i])
                z = p.z
                cols.append(st['sole'] if z < fz + 0.012 else (st['cuff'] if st['cuff'] and z > top - 0.035 * s else st['leather']))
            vs.append(row)
        for k in range(len(vs) - 1):
            for a in range(NA):
                a2 = (a + 1) % NA
                try: bm.faces.new([vs[k][a], vs[k][a2], vs[k + 1][a2], vs[k + 1][a]])
                except ValueError: pass
        try: bm.faces.new(list(reversed(vs[0])))
        except ValueError: pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish_shell(n, 'boots_' + n, bm, per, cols, smooth=0)

def build_gear():
    for n in NAMES:
        build_hat(n); build_scarf(n); build_gloves(n); build_boots(n)
