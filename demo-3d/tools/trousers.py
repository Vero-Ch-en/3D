"""His trousers (build 85): turns leggings_player into straight-leg trousers, in Blender.

Run inside Blender on cozy_characters_overcoats.blend (or a copy), then save as a NEW file
(cozy_characters_trousers.blend). Nothing else in the scene is changed.

What it does
  - Keeps the original as a hidden `backup_leggings_player` and always starts again from it.
  - Thigh: the leggings' own shape plus ~1.2 cm of ease (fading out toward the crotch and waist).
  - From just under the knee (the cut at z = 0.50) down: the original leggings were open at the back of the calf
    (knee socks covered it), so that part is replaced by a new tube of rings around the middle of his actual calf,
    with a radius that clears every point of the body surface by CLEAR (sampled on its faces, not just corners,
    because the body is very sparse under the socks), tapering a little to an ankle hem with a turned-under edge.
  - New vertices take their skin weights from the body underneath, so they bend with the legs.
  - Smooth shading; a few smoothing passes over the knee hand-over.
Export with export_trousers(); the game side is tools/patch_gear.js (key leggings_player).
"""
import bpy, bmesh, math, struct, base64
from mathutils import Vector, kdtree
from collections import defaultdict

CX = -0.45                     # between his legs (world x)
HEM, KNEE, CUT = 0.095, 0.53, 0.50
CROTCH_LO, CROTCH_HI = 0.80, 0.93
EASE, CLEAR = 0.012, 0.009


def sstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)


def build():
    leg = bpy.data.objects['leggings_player']; body = bpy.data.objects['human_player']
    if 'backup_leggings_player' not in bpy.data.objects:
        b = leg.copy(); b.data = leg.data.copy(); b.name = b.data.name = 'backup_leggings_player'
        for c in leg.users_collection: c.objects.link(b)
        b.hide_set(True); b.hide_render = True
    src = bpy.data.objects['backup_leggings_player']
    old = leg.data; leg.data = src.data.copy(); leg.data.name = 'leggings_player'
    mw = leg.matrix_world; inv = mw.inverted(); me = leg.data; bmw = body.matrix_world; bd = body.data

    # The body's lower-leg surface, sampled on its faces, per side and 2 cm slice.
    S = defaultdict(list)
    for poly in bd.polygons:
        vs = [bmw @ bd.vertices[i].co for i in poly.vertices]
        if max(p.z for p in vs) < 0.06 or min(p.z for p in vs) > 0.64: continue
        c0 = sum(vs, Vector()) / len(vs)
        for i in range(len(vs)):
            a, b = vs[i], vs[(i + 1) % len(vs)]
            for u in (0, 0.2, 0.4, 0.6, 0.8):
                for w in (0, 0.3, 0.6):
                    p = a.lerp(b, u).lerp(c0, w)
                    if 0.06 < p.z < 0.64 and abs(p.x - CX) < 0.4: S[(p.x > CX, int(p.z / 0.02))].append(p)
    prof = {}
    for side in (False, True):
        zs = [0.02 * k + 0.01 for k in range(32)]; cs = []; rs = []
        for k in range(32):
            P = S.get((side, k), [])
            if len(P) >= 6:
                cx = (min(p.x for p in P) + max(p.x for p in P)) / 2; cy = (min(p.y for p in P) + max(p.y for p in P)) / 2
                cs.append(Vector((cx, cy, 0))); rs.append(max(math.hypot(p.x - cx, p.y - cy) for p in P))
            else: cs.append(None); rs.append(0.0)
        for i in range(len(cs)):
            if cs[i] is None:
                j = next((k for k in range(i, len(cs)) if cs[k] is not None), None); h = next((k for k in range(i, -1, -1) if cs[k] is not None), None)
                cs[i] = cs[j] if h is None else cs[h] if j is None else cs[h].lerp(cs[j], (i - h) / (j - h))
        for it in range(4): cs = [cs[0]] + [(cs[i - 1] + cs[i] * 2 + cs[i + 1]) / 4 for i in range(1, len(cs) - 1)] + [cs[-1]]
        def rmin(z): return 0.072 - 0.009 * max(0.0, min(1.0, (0.46 - z) / (0.46 - HEM)))
        need = [max(max(rs[j] for j in range(len(zs)) if abs(zs[j] - z) <= 0.061) + CLEAR, rmin(z)) for z in zs]
        for it in range(5): need = [need[0]] + [max(need[i], (need[i - 1] + need[i] * 2 + need[i + 1]) / 4) for i in range(1, len(need) - 1)] + [need[-1]]
        prof[side] = (zs, cs, need)

    def at(side, z, which):
        zs, cs, need = prof[side]; f = (z - zs[0]) / 0.02; i = max(0, min(len(zs) - 2, int(f))); t = max(0.0, min(1.0, f - i))
        return cs[i].lerp(cs[i + 1], t) if which == 'c' else need[i] * (1 - t) + need[i + 1] * t

    # Thigh: ease round the leggings' own centre at each height.
    L = [mw @ v.co for v in me.vertices]; cache = {}
    def lcentre(side, z):
        sel = [p for p in L if abs(p.z - z) < 0.01 and ((p.x > CX) == side)]
        return Vector((sum(p.x for p in sel) / len(sel), sum(p.y for p in sel) / len(sel), 0)) if sel else None
    for v in me.vertices:
        p = mw @ v.co; z = p.z
        if z > CROTCH_HI or z < CUT - 0.05: continue
        side = p.x > CX; key = (side, round(z, 2))
        if key not in cache: cache[key] = lcentre(side, z)
        c = cache[key]
        if c is None: continue
        d = Vector((p.x - c.x, p.y - c.y, 0)); r = d.length
        if r < 1e-5: continue
        kc = 1.0 if z < CROTCH_LO else (CROTCH_HI - z) / (CROTCH_HI - CROTCH_LO)
        v.co = inv @ (Vector((c.x, c.y, z)) + d / r * (r + EASE * kc))

    bm = bmesh.new(); bm.from_mesh(me)
    # Cut: every face dipping below the line goes, so the join is one clean ring per leg.
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if any((mw @ v.co).z < CUT for v in f.verts)], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table()
    bnd = [e for e in bm.edges if e.is_boundary]; adj = {}
    for e in bnd:
        for v in e.verts: adj.setdefault(v, []).append(e)
    rings = []; used = set()
    for e in bnd:
        if e in used: continue
        v0 = e.verts[0]; ring = [v0]; prev = None; cur = v0
        while True:
            nxt = [x for x in adj[cur] if x not in used and x is not prev]
            if not nxt: break
            x = nxt[0]; used.add(x); prev = x; cur = x.other_vert(cur)
            if cur is v0: break
            ring.append(cur)
        if max((mw @ v.co).z for v in ring) < 0.75: rings.append(ring)   # not the waist
    bpts = [bmw @ v.co for v in bd.vertices]; G = {g.index: g.name for g in body.vertex_groups}
    kd = kdtree.KDTree(len(bpts))
    for i, p in enumerate(bpts): kd.insert(p, i)
    kd.balance()
    LG = {g.name: g.index for g in leg.vertex_groups}; dl = bm.verts.layers.deform.verify()
    for ring in rings:
        pts = [mw @ v.co for v in ring]; side = (sum(p.x for p in pts) / len(pts)) > CX
        ztop = min(p.z for p in pts); rc = sum((Vector((p.x, p.y, 0)) for p in pts), Vector()) / len(pts)
        area = sum((pts[i].x - rc.x) * (pts[(i + 1) % len(pts)].y - rc.y) - (pts[(i + 1) % len(pts)].x - rc.x) * (pts[i].y - rc.y) for i in range(len(pts)))
        if area < 0: ring = ring[::-1]; pts = pts[::-1]
        ang = [math.atan2(p.y - rc.y, p.x - rc.x) for p in pts]; rr = [math.hypot(p.x - rc.x, p.y - rc.y) for p in pts]
        NL = 20; levels = [ztop - 0.015 - k * ((ztop - 0.015 - HEM) / (NL - 1)) for k in range(NL)] + [HEM - 0.007]
        prev = ring
        for li, z in enumerate(levels):
            last = li == len(levels) - 1; zz = max(z, HEM); t = sstep(0, 6, li + 1)
            c = rc.lerp(at(side, zz, 'c'), t); new = []
            for j, a in enumerate(ang):
                R = (rr[j] * (1 - t) + at(side, zz, 'r') * t) * (0.9 if last else 1.0)   # the last ring turns under
                v = bm.verts.new(inv @ Vector((c.x + math.cos(a) * R, c.y + math.sin(a) * R, z)))
                _, bi, _ = kd.find(Vector((c.x + math.cos(a) * 0.03, c.y + math.sin(a) * 0.03, max(z, HEM + 0.01))))
                for nm, w in sorted(((G[g.group], g.weight) for g in bd.vertices[bi].groups if g.group in G and g.weight > 1e-3), key=lambda x: -x[1])[:4]:
                    if nm not in LG: LG[nm] = leg.vertex_groups.new(name=nm).index
                    v[dl][LG[nm]] = w
                new.append(v)
            for j in range(len(new)):
                try: bm.faces.new((prev[j], prev[(j + 1) % len(prev)], new[(j + 1) % len(new)], new[j]))
                except ValueError: pass
            prev = new
    for f in bm.faces: f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    sel = [v for v in bm.verts if HEM + 0.01 < (mw @ v.co).z < KNEE + 0.15 and not v.is_boundary]
    for it in range(8): bmesh.ops.smooth_vert(bm, verts=sel, factor=0.4, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(me); bm.free(); me.update(); bpy.data.meshes.remove(old)
    return len(me.vertices)


def export_trousers():
    """Same binary layout as overcoat.export_obj (read by tools/patch_gear.js): returns (meta, base64)."""
    ob = bpy.data.objects['leggings_player']; rig = bpy.data.objects['rig_game_player']
    pp = rig.data.pose_position; rig.data.pose_position = 'REST'
    arm = ob.modifiers.get('Armature'); arm.show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get(); dg.update()
    e = ob.evaluated_get(dg); m = e.to_mesh(); m.calc_loop_triangles()
    mw = ob.matrix_world; nm = mw.to_3x3(); G = {g.index: g.name for g in ob.vertex_groups}
    cn = m.corner_normals; uvl = m.uv_layers.active; names = []
    def jid(k):
        k = k.replace('mixamorig:', '')
        if k not in names: names.append(k)
        return names.index(k)
    verts = []; kmap = {}; idx = []
    for tri in m.loop_triangles:
        for li in tri.loops:
            vi = m.loops[li].vertex_index; p = mw @ m.vertices[vi].co; nr = (nm @ cn[li].vector).normalized()
            uv = tuple(uvl.data[li].uv) if uvl else (p.x / 0.3, p.z / 0.3)
            kk = (vi, round(nr.x, 2), round(nr.y, 2), round(nr.z, 2), round(uv[0], 3), round(uv[1], 3))
            if kk not in kmap:
                ws = sorted(((jid(G[g.group]), g.weight) for g in m.vertices[vi].groups if g.weight > 1e-3 and g.group in G), key=lambda x: -x[1])[:4]
                kmap[kk] = len(verts); verts.append((p, nr, uv, ws))
            idx.append(kmap[kk])
    e.to_mesh_clear(); arm.show_viewport = True; rig.data.pose_position = pp
    b = bytearray()
    for p, nr, uv, ws in verts:
        b += struct.pack('<8f', p.x, p.y, p.z, nr.x, nr.y, nr.z, uv[0], uv[1]) + bytes((255, 255, 255))
        ws = ws + [(0, 0.0)] * (4 - len(ws)); t = sum(w for _, w in ws) or 1
        for j, w in ws: b += struct.pack('<Bf', j, w / t)
    meta = dict(n='player', nv=len(verts), ni=len(idx), names=names)
    return meta, base64.b64encode(bytes(b) + struct.pack('<%dH' % len(idx), *idx)).decode()
