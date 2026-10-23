"""Tailored wool overcoats for the realistic characters (run inside Blender on cozy_characters_coats_tailored.blend;
build 57). Starts from the original coats (backup_coat_<name>, the coats tools/coats.py made) and:

  1. tailors them to the jumper under them: the body to its torso, the sleeves to its arms (1.5 / 1.2 cm ease),
     the front closed with an overlap, the back seam welded, the collar raised over the jumper's neck, the cuffs
     down to just past the wrist, the sleeve heads tucked under the shoulders;
  2. the skirt hangs from the hips like cloth (flare toward the hem, never curving back in under the seat) and
     is weighted so the front lies on the thighs when sitting and follows the legs when walking;
  3. adds the overcoat itself: a V opening with notched lapels, a turned-down collar, three buttons, two flap
     pockets and turn-back cuffs, plus wool thickness (solidify) on everything;
  4. exports the whole coat (positions, normals, box-projected UVs, vertex colours, four bone weights) for
     tools/patch_overcoat.js, which rebuilds the coat in models/real/<name>.glb and js/models_real.js.

Usage in Blender: load this as a text block in pieces of under ~10 kB (one big call froze the link), exec it,
then build_all(), export(name) and export_chunk(name, i). Result kept in cozy_characters_overcoats.blend.
Everything is in world space at the rig's rest pose."""
import bpy, bmesh, math, json, base64, struct
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.interpolate import poly_3d_calc
from mathutils.geometry import intersect_point_line
from mathutils import kdtree

NAMES = ('partner', 'player')
isArm = lambda k: ('Arm' in k or 'Hand' in k)


def ss(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t)


def rig(n): return bpy.data.objects['rig_game_' + n]
def coat(n): return bpy.data.objects['coat_' + n]


def rest(n):
    r = rig(n)
    for pb in r.pose.bones:
        pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()


def J(n, b):
    r = rig(n); return r.matrix_world @ r.data.bones['mixamorig:' + b].head_local


def land(n):
    L = dict(hips=J(n, 'Hips'), neck=J(n, 'Neck'), sp2=J(n, 'Spine2'), arm=J(n, 'LeftArm'))
    s = (L['neck'].z - L['hips'].z) / 0.554
    L.update(s=s, cx=L['hips'].x, zB=L['neck'].z - 0.21 * s, zN=L['neck'].z - 0.015 * s, e=0.055 * s,
             zTop=J(n, 'LeftUpLeg').z - 0.02)
    return L


def world_mesh(o):
    dg = bpy.context.evaluated_depsgraph_get(); e = o.evaluated_get(dg); m = e.to_mesh()
    V = [o.matrix_world @ v.co for v in m.vertices]; F = [list(p.vertices) for p in m.polygons]
    G = {g.index: g.name for g in o.vertex_groups}
    Wt = [{G[g.group]: g.weight for g in v.groups if g.weight > 0 and G[g.group].startswith('mixamorig:')} for v in m.vertices]
    e.to_mesh_clear(); return V, F, Wt


def targets(n):
    """The jumper (and his hoodie cord) split into arm and torso surfaces, with its own skin weights."""
    V = []; Wt = []; FA = []; FT = []
    for o in [bpy.data.objects[x] for x in ('sweater_' + n, 'cord_' + n + '_1') if x in bpy.data.objects]:
        v, f, w = world_mesh(o); off = len(V); V += v; Wt += w
        arm = [sum(x for k, x in d.items() if isArm(k)) / (sum(d.values()) or 1) for d in w]
        for p in f:
            (FA if sum(arm[i] for i in p) / len(p) > 0.5 else FT).append([i + off for i in p])
    T = dict(V=V, W=Wt, FA=FA, FT=FT, tA=BVHTree.FromPolygons(V, FA), tT=BVHTree.FromPolygons(V, FT))
    T['FALL'] = FA + FT; T['tAll'] = BVHTree.FromPolygons(V, T['FALL'])
    return T


def interp_w(T, F, fi, loc):
    ids = F[fi]; bw = poly_3d_calc([T['V'][i] for i in ids], loc); acc = {}
    for i, b in zip(ids, bw):
        for k, x in T['W'][i].items(): acc[k] = acc.get(k, 0) + x * b
    return acc


def set_weights(c, i, new, CG):
    v = c.data.vertices[i]; t = sum(new.values()) or 1
    for g in list(v.groups): c.vertex_groups[CG[g.group]].remove([i])
    for k, x in new.items():
        if x / t > 1e-3: (c.vertex_groups.get(k) or c.vertex_groups.new(name=k)).add([i], x / t, 'REPLACE')


# ------------------------------------------------------------------ 1. tailoring
def refit(n, eb=0.015, ea=0.012, iters=8, relax=0.5, pit=0.07):
    rest(n); T = targets(n); L = land(n)
    c = coat(n); b = bpy.data.objects['backup_coat_' + n]; me = c.data
    for v, w in zip(me.vertices, b.data.vertices): v.co = w.co.copy()
    zHip = L['hips'].z; zTop = L['zTop']; zPit = (J(n, 'LeftArm').z + J(n, 'RightArm').z) / 2 - pit
    nb, ns = c['body_verts'], c['sleeve_verts']; sl = lambda i: nb <= i < nb + ns
    mw = c.matrix_world; iw = mw.inverted()
    orig = [v.co.copy() for v in me.vertices]; pos = [mw @ x for x in orig]
    def wf(i, p):
        if sl(i) or p.z >= zHip + 0.06: return 1.0
        if p.z <= zTop - 0.04: return 0.0
        return (p.z - (zTop - 0.04)) / ((zHip + 0.06) - (zTop - 0.04))
    w8 = [wf(i, p) for i, p in enumerate(pos)]
    cap = [0.0 if sl(i) else ss(zPit - 0.01, zPit + 0.03, p.z) for i, p in enumerate(pos)]
    nbrs = [[] for _ in pos]
    for e in me.edges: a, bb = e.vertices; nbrs[a].append(bb); nbrs[bb].append(a)
    def project():
        for i, p in enumerate(pos):
            if w8[i] <= 0: continue
            if sl(i): tree = T['tA']; ease = ea
            else: tree = T['tAll'] if cap[i] > 0.5 else T['tT']; ease = eb
            loc, nor, fi, d = tree.find_nearest(p)
            if loc is None: continue
            s = (p - loc).dot(nor)
            if s > ease or s < ease * 0.7: pos[i] = p.lerp(loc + nor * ease, w8[i])
    for _ in range(iters):
        project()
        new = [p.copy() for p in pos]
        for i, p in enumerate(pos):
            if w8[i] > 0 and nbrs[i]:
                new[i] = p.lerp(sum((pos[j] for j in nbrs[i]), Vector()) / len(nbrs[i]), relax * w8[i])
        pos[:] = new
    project()
    for i, v in enumerate(me.vertices): v.co = iw @ pos[i] if w8[i] > 0 else orig[i]
    me.update()
    # weights above the hips: the jumper's own (sleeves from its arms, body from its torso; over the shoulder both)
    CG = {g.index: g.name for g in c.vertex_groups}
    for i, v in enumerate(me.vertices):
        p = mw @ v.co
        if not sl(i) and p.z < zTop + 0.04: continue
        if sl(i): F = T['FA']; tree = T['tA']
        elif ss(zPit - 0.01, zPit + 0.03, p.z) > 0.5: F = T['FALL']; tree = T['tAll']
        else: F = T['FT']; tree = T['tT']
        loc, nor, fi, d = tree.find_nearest(p)
        acc = interp_w(T, F, fi, loc)
        if not sl(i):
            for k in list(acc):
                if 'ForeArm' in k or 'Hand' in k: acc.pop(k)
        s = sum(acc.values())
        if s <= 0: continue
        f = 1.0 if sl(i) else min(1, (p.z - (zTop + 0.04)) / 0.08)
        old = {CG[g.group]: g.weight for g in v.groups}
        set_weights(c, i, {k: (1 - f) * old.get(k, 0) + f * acc.get(k, 0) / s for k in set(acc) | set(old)}, CG)


def close_front(n, cross=0.006, lift=0.004, band=0.10):
    """Front edges overlap by 1.2 cm (the right-hand flap on top) instead of leaving a gap."""
    L = land(n); c = coat(n); me = c.data; mw = c.matrix_world; iw = mw.inverted(); cx = L['cx']
    nb, ns = c['body_verts'], c['sleeve_verts']
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    edge = [v for v in bm.verts if not (nb <= v.index < nb + ns) and v.is_boundary
            and L['zTop'] - 0.10 < (mw @ v.co).z < L['neck'].z - 0.02 and (mw @ v.co).y < L['hips'].y and abs((mw @ v.co).x - cx) < band]
    for v in edge:
        p = mw @ v.co; side = 1 if p.x > cx else -1; f = min(1, max(0, (p.z - (L['zTop'] - 0.10)) / 0.12))
        p.x += (cx - side * cross - p.x) * f
        if side > 0: p.y -= lift * f
        v.co = iw @ p
    for v in edge:
        if (mw @ v.co).x < cx:
            for e in v.link_edges:
                o = e.other_vert(v)
                if o.is_boundary: continue
                q = mw @ o.co
                if cx - 0.03 < q.x < cx + 0.05: q.y -= lift * 0.5; o.co = iw @ q
    bm.to_mesh(me); bm.free(); me.update()


def collar(n, rise=0.006, ease=0.012):
    """The coat's neckline up over the jumper's neckline, smoothed."""
    L = land(n); c = coat(n); me = c.data; mw = c.matrix_world; iw = mw.inverted(); neck = L['neck']; A = L['arm']
    nb, ns = c['body_verts'], c['sleeve_verts']
    SV, _, _ = world_mesh(bpy.data.objects['sweater_' + n])
    band = [p for p in SV if p.z > A.z - 0.02 and math.hypot(p.x - neck.x, p.y - neck.y) < 0.12]
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    ring = [v for v in bm.verts if v.is_boundary and not (nb <= v.index < nb + ns) and (mw @ v.co).z > A.z - 0.03
            and math.hypot((mw @ v.co).x - neck.x, (mw @ v.co).y - neck.y) < 0.13]
    ang = lambda p: math.atan2(p.y - neck.y, p.x - neck.x)
    adiff = lambda a, b: abs((a - b + math.pi) % (2 * math.pi) - math.pi)
    for v in ring:
        p = mw @ v.co; a = ang(p); near = [q for q in band if adiff(ang(q), a) < 0.3]
        if not near: continue
        top = max(near, key=lambda q: q.z)
        rz = max(math.hypot(q.x - neck.x, q.y - neck.y) for q in near if q.z > top.z - 0.02)
        z = max(p.z, top.z + rise); rad = max(math.hypot(p.x - neck.x, p.y - neck.y), rz + ease)
        v.co = iw @ Vector((neck.x + math.cos(a) * rad, neck.y + math.sin(a) * rad, z))
    rs = set(ring)
    for _ in range(4):
        upd = {}
        for v in ring:
            nbv = [e.other_vert(v) for e in v.link_edges if e.is_boundary and e.other_vert(v) in rs]
            if len(nbv) == 2: upd[v] = v.co.lerp((nbv[0].co + nbv[1].co) / 2, 0.5)
        for v, co in upd.items(): v.co = co
    for v in ring:
        for e in v.link_edges:
            o = e.other_vert(v)
            if o not in rs and not o.is_boundary: o.co = o.co.lerp((v.co + o.co) / 2, 0.3)
    bm.to_mesh(me); bm.free(); me.update()


def along(S, E, H, p):
    up = (E - S).length; lo = (H - E).length
    _, t1 = intersect_point_line(p, S, E)
    if t1 <= 1: return t1 * up
    _, t2 = intersect_point_line(p, E, H); return up + t2 * lo


def sleeves(n, past=0.006, ea=0.012, cap_ease=0.007, cap_len=0.05):
    """Cuffs to just past the wrist, tapered onto the jumper's cuff; sleeve heads a little closer in."""
    rest(n); T = targets(n); c = coat(n); me = c.data; mw = c.matrix_world; iw = mw.inverted()
    nb, ns = c['body_verts'], c['sleeve_verts']
    for side in ('Left', 'Right'):
        S, E, H = J(n, side + 'Arm'), J(n, side + 'ForeArm'), J(n, side + 'Hand'); up = (E - S).length; lo = (H - E).length
        axis = (H - E).normalized()
        idx = [i for i in range(nb, nb + ns) if (intersect_point_line(mw @ me.vertices[i].co, S, H)[0] - mw @ me.vertices[i].co).length < 0.12
               and ((mw @ me.vertices[i].co) - S).length < 0.7]
        ds = {i: along(S, E, H, mw @ me.vertices[i].co) for i in idx}
        dC = max(ds.values()); want = up + lo + past; k = (want - up) / (dC - up) if dC > up else 1
        for i, d in ds.items():
            p = mw @ me.vertices[i].co
            if d > up and k != 1: p = p + axis * ((up + (d - up) * k) - d)
            ease = cap_ease + (ea - cap_ease) * ss(0.0, cap_len, along(S, E, H, p))
            loc, nor, fi, _ = T['tA'].find_nearest(p)
            if loc is not None:
                s = (p - loc).dot(nor)
                if s > ease or s < ease * 0.7: p = loc + nor * ease
            me.vertices[i].co = iw @ p
    me.update()


def caps(n, lift=0.03, cap_len=0.07, ease=0.007):
    """Sleeve heads raised up under the coat's shoulders, so no jumper shows at the shoulder point."""
    rest(n); T = targets(n); c = coat(n); me = c.data; mw = c.matrix_world; iw = mw.inverted()
    nb, ns = c['body_verts'], c['sleeve_verts']
    for side in ('Left', 'Right'):
        S, E = J(n, side + 'Arm'), J(n, side + 'ForeArm'); up = (S - E).normalized(); Lu = (E - S).length
        for i in range(nb, nb + ns):
            p = mw @ me.vertices[i].co; q, t = intersect_point_line(p, S, E)
            if (q - p).length > 0.12 or t > 0.6 or (p - S).length > 0.25: continue
            d = t * Lu
            if d > cap_len: continue
            f = ss(cap_len, 0.0, d); p = p + up * lift * f
            loc, nor, fi, _ = T['tAll'].find_nearest(p)
            if loc is not None:
                s = (p - loc).dot(nor)
                if s > ease * 1.5 or s < ease: p = p.lerp(loc + nor * ease, f)
            me.vertices[i].co = iw @ p
    me.update()


def legs_tree(n):
    V = []; F = []; dg = bpy.context.evaluated_depsgraph_get()
    legish = lambda k: any(x in k for x in ('UpLeg', 'Leg', 'Foot', 'Toe', 'Hips'))
    for nm in ('leggings_' + n, 'human_' + n):
        o = bpy.data.objects.get(nm)
        if not o: continue
        G = {g.index: g.name for g in o.vertex_groups}; e = o.evaluated_get(dg); m = e.to_mesh(); off = len(V); ok = []
        for v in m.vertices:
            ws = {G[g.group]: g.weight for g in v.groups if g.group in G}; t = sum(ws.values()) or 1
            ok.append(sum(w for k, w in ws.items() if legish(k)) / t > 0.6 and not any(isArm(k) and w > 0.05 for k, w in ws.items()))
        V += [o.matrix_world @ v.co for v in m.vertices]
        F += [[off + j for j in p.vertices] for p in m.polygons if all(ok[j] for j in p.vertices)]
        e.to_mesh_clear()
    return BVHTree.FromPolygons(V, F)


def skirt(n, flare=0.20, clear=0.03):
    """From the hips down: an even A-line from the fitted hips to the hem, clear of the legs."""
    rest(n); L = land(n); zTop = L['zTop']
    c = coat(n); me = c.data; mw = c.matrix_world; iw = mw.inverted(); b = bpy.data.objects['backup_coat_' + n]
    nb, ns = c['body_verts'], c['sleeve_verts']
    for i, v in enumerate(me.vertices):
        if not (nb <= i < nb + ns) and (mw @ b.data.vertices[i].co).z < zTop - 0.04: v.co = b.data.vertices[i].co.copy()
    body = [(i, mw @ v.co) for i, v in enumerate(me.vertices) if not (nb <= i < nb + ns)]
    ring = [p for i, p in body if zTop + 0.02 < p.z < zTop + 0.10]
    cx = sum(p.x for p in ring) / len(ring); cy = sum(p.y for p in ring) / len(ring)
    NB = 48; acc = [[] for _ in range(NB)]; ang = lambda p: math.atan2(p.y - cy, p.x - cx)
    for p in ring: acc[int((ang(p) + math.pi) / (2 * math.pi) * NB) % NB].append(math.hypot(p.x - cx, p.y - cy))
    rr = [sum(a) / len(a) if a else None for a in acc]
    for k in range(NB):
        if rr[k] is None:
            j = 1
            while rr[(k - j) % NB] is None and rr[(k + j) % NB] is None: j += 1
            rr[k] = rr[(k - j) % NB] if rr[(k - j) % NB] is not None else rr[(k + j) % NB]
    def rHip(a):
        f = (a + math.pi) / (2 * math.pi) * NB - 0.5; k0 = int(math.floor(f)) % NB; t = f - math.floor(f)
        return rr[k0] * (1 - t) + rr[(k0 + 1) % NB] * t
    zHem = min(p.z for i, p in body); Lh = zTop + 0.04 - zHem; legs = legs_tree(n)
    for i, p in body:
        if p.z >= zTop + 0.04: continue
        d = (zTop + 0.04 - p.z) / Lh; a = ang(p); want = rHip(a) * (1 + flare * d ** 1.2)
        cur = math.hypot(p.x - cx, p.y - cy); blend = min(1, (zTop + 0.04 - p.z) / 0.06)
        rad = cur * (1 - blend) + want * blend if cur > want else cur
        q = Vector((cx + math.cos(a) * rad, cy + math.sin(a) * rad, p.z))
        loc, nor, fi, dd = legs.find_nearest(q)
        if loc is not None:
            s = (q - loc).dot(nor)
            if s < clear: q = q + Vector((math.cos(a), math.sin(a), 0)) * (clear - s)
        me.vertices[i].co = iw @ q
    me.update()


def drape(n, NB=40):
    """Below the waist a coat hangs: no surface curving back in under the seat or the tummy."""
    rest(n); L = land(n); c = coat(n); me = c.data; mw = c.matrix_world; iw = mw.inverted()
    nb, ns = c['body_verts'], c['sleeve_verts']
    body = [(i, mw @ v.co) for i, v in enumerate(me.vertices) if not (nb <= i < nb + ns)]
    zW = L['hips'].z + 0.10; ring = [p for i, p in body if zW - 0.03 < p.z < zW + 0.03]
    cx = sum(p.x for p in ring) / len(ring); cy = sum(p.y for p in ring) / len(ring)
    ang = lambda p: math.atan2(p.y - cy, p.x - cx); rad = lambda p: math.hypot(p.x - cx, p.y - cy)
    best = [0.0] * NB
    for p in ring:
        k = int((ang(p) + math.pi) / (2 * math.pi) * NB) % NB; best[k] = max(best[k], rad(p))
    for i, p in sorted([(i, p) for i, p in body if p.z < zW], key=lambda t: -t[1].z):
        a = ang(p); k = int((a + math.pi) / (2 * math.pi) * NB) % NB; r0 = rad(p)
        if r0 < best[k] - 0.002:
            nr = best[k] - 0.002; me.vertices[i].co = iw @ Vector((cx + math.cos(a) * nr, cy + math.sin(a) * nr, p.z))
        else: best[k] = max(best[k], r0)
    me.update()


def weight_skirt(n, front_follow=0.95, back_follow=0.3, ramp=0.10, top_blend=0.05, e0=-0.55, e1=0.15):
    """Front and sides follow the thighs (so they lie on the lap when sitting), the back mostly the hips and the
    coat-tail spring bones; under the knee the hem drapes with the shin."""
    rest(n); L = land(n); c = coat(n); me = c.data; mw = c.matrix_world
    hips = L['hips']; zTop = L['zTop']; Lx = J(n, 'LeftUpLeg').x; knee = (J(n, 'LeftLeg').z + J(n, 'RightLeg').z) / 2
    sgn = 1 if Lx > hips.x else -1
    nb, ns = c['body_verts'], c['sleeve_verts']
    body = [(i, mw @ v.co) for i, v in enumerate(me.vertices) if not (nb <= i < nb + ns)]
    ring = [p for i, p in body if zTop - 0.02 < p.z < zTop + 0.04]
    cx = sum(p.x for p in ring) / len(ring); cy = sum(p.y for p in ring) / len(ring)
    zHem = min(p.z for i, p in body); z0 = zTop + 0.06
    CG = {g.index: g.name for g in c.vertex_groups}
    for i, p in body:
        if p.z >= z0: continue
        t = (z0 - p.z) / (z0 - zHem); r0 = math.hypot(p.x - cx, p.y - cy) or 1e-6
        fs = -(p.y - cy) / r0; bk = max(0, -fs); left = ss(-0.03, 0.03, (p.x - cx) * sgn)
        follow = (back_follow + (front_follow - back_follow) * ss(e0, e1, fs)) * ss(0, ramp, t)
        below = ss(knee + 0.02, knee - 0.08, p.z); legU = follow * (1 - below * 0.7); legL = follow * below * 0.7
        tail = (1 - follow) * 0.6 * ss(0.15, 0.8, t) * (0.4 + 0.6 * bk); hipw = max(0, 1 - follow - tail)
        new = {'mixamorig:Hips': hipw, 'mixamorig:LeftUpLeg': legU * left, 'mixamorig:RightUpLeg': legU * (1 - left),
               'mixamorig:LeftLeg': legL * left, 'mixamorig:RightLeg': legL * (1 - left), 'coat_L': tail * left, 'coat_R': tail * (1 - left)}
        blend = ss(z0, z0 - top_blend, p.z)
        if blend < 1:
            old = {CG[g.group]: g.weight for g in me.vertices[i].groups if not CG[g.group].endswith(('UpLeg', 'Leg')) and not CG[g.group].startswith('coat_')}
            ot = sum(old.values()) or 1; new = {k: x * blend for k, x in new.items()}
            for k, x in old.items(): new[k] = new.get(k, 0) + x / ot * (1 - blend)
        set_weights(c, i, new, CG)


def weld(n, r=0.0015):
    """The back seam (and any other doubled vertices above the vent) joined again, weights averaged."""
    rest(n); L = land(n); c = coat(n); b = bpy.data.objects['backup_coat_' + n]; me = c.data; mw = c.matrix_world
    orig = [v.co.copy() for v in b.data.vertices]; kd = kdtree.KDTree(len(orig))
    for i, co in enumerate(orig): kd.insert(co, i)
    kd.balance(); done = set(); CG = {g.index: g.name for g in c.vertex_groups}
    for i, co in enumerate(orig):
        if i in done or (mw @ co).z <= L['zTop']: continue
        grp = [j for (_, j, _) in kd.find_range(co, r)]
        if len(grp) < 2: continue
        avg = sum((me.vertices[j].co for j in grp), Vector()) / len(grp); ws = {}
        for j in grp:
            for g in me.vertices[j].groups: ws[CG[g.group]] = ws.get(CG[g.group], 0) + g.weight / len(grp)
        for j in grp: me.vertices[j].co = avg.copy(); done.add(j); set_weights(c, j, ws, CG)
    me.update()


def mark_parts(n):
    c = coat(n); me = c.data; nb, ns = c['body_verts'], c['sleeve_verts']
    a = me.attributes.get('part') or me.attributes.new('part', 'INT', 'POINT')
    for i in range(len(me.vertices)): a.data[i].value = 1 if nb <= i < nb + ns else 0


def fix_normals(n):
    """Consistent winding, facing outward (the original coat's right half was inside out)."""
    rest(n); c = coat(n); me = c.data; mw = c.matrix_world
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    segs = [(J(n, 'Hips'), J(n, 'Neck')), (J(n, 'LeftArm'), J(n, 'LeftHand')), (J(n, 'RightArm'), J(n, 'RightHand')),
            (J(n, 'LeftUpLeg'), J(n, 'LeftLeg')), (J(n, 'RightUpLeg'), J(n, 'RightLeg'))]
    def axis_pt(p):
        best = None
        for a, b in segs:
            q, t = intersect_point_line(p, a, b); t = max(0, min(1, t)); q = a + (b - a) * t
            if best is None or (p - q).length < (p - best).length: best = q
        return best
    seen = set()
    for f0 in bm.faces:
        if f0.index in seen: continue
        comp = []; st = [f0]; seen.add(f0.index)
        while st:
            f = st.pop(); comp.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g.index not in seen: seen.add(g.index); st.append(g)
        vote = sum((mw.to_3x3() @ f.normal).dot((mw @ f.calc_center_median() - axis_pt(mw @ f.calc_center_median())).normalized()) * f.calc_area() for f in comp)
        if vote < 0: bmesh.ops.reverse_faces(bm, faces=comp)
    bm.to_mesh(me); bm.free(); me.update()


def cut_v(n):
    """The V opening between the lapels, cut on exact lines (bisect), down to the top button."""
    rest(n); L = land(n); c = coat(n); me = c.data; mw = c.matrix_world; iw = mw.inverted()
    cx, zB, zN, e = L['cx'], L['zB'], L['zN'], L['e']; fy = L['hips'].y
    bm = bmesh.new(); bm.from_mesh(me); part = bm.verts.layers.int.get('part')
    def front_faces():
        out = []
        for f in bm.faces:
            m = mw @ f.calc_center_median()
            if all(v[part] == 0 for v in f.verts) and m.y < fy and zB - 0.03 < m.z < L['neck'].z + 0.1 and abs(m.x - cx) < e + 0.08: out.append(f)
        return out
    for side in (1, -1):
        P0 = Vector((cx, 0, zB)); P1 = Vector((cx + side * e, 0, zN)); nrm = (P1 - P0).cross(Vector((0, 1, 0))).normalized()
        ff = front_faces(); geom = list({x for f in ff for x in list(f.verts) + list(f.edges)}) + ff
        bmesh.ops.bisect_plane(bm, geom=geom, dist=0.0005, plane_co=iw @ P0, plane_no=(iw.to_3x3() @ nrm).normalized())
    def inside(p):
        if p.y > fy or p.z <= zB + 0.002: return False
        t = min(1.0, (p.z - zB) / (zN - zB)) if p.z < zN else 1.0
        return abs(p.x - cx) < e * t - 0.001
    kill = [f for f in bm.faces if all(v[part] == 0 for v in f.verts) and inside(mw @ f.calc_center_median())]
    bmesh.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(me); bm.free(); me.update()


def reset_topology(n):
    """A fresh copy of the original coat mesh: every step assumes its vertex numbering (the V cut adds vertices)."""
    c = coat(n); b = bpy.data.objects['backup_coat_' + n]
    old = c.data; c.data = b.data.copy(); c.data.name = 'coat_' + n
    if old.users == 0: bpy.data.meshes.remove(old)
    for g in list(c.vertex_groups): c.vertex_groups.remove(g)
    for g in b.vertex_groups: c.vertex_groups.new(name=g.name)


def build(n):
    reset_topology(n); refit(n); close_front(n); collar(n); sleeves(n); caps(n); skirt(n); drape(n); weight_skirt(n); weld(n)
    mark_parts(n); fix_normals(n); cut_v(n)
    for p in coat(n).data.polygons: p.use_smooth = True


# ------------------------------------------------------------------ 3. the overcoat's details
def surf(n):
    c = coat(n); me = c.data; mw = c.matrix_world; part = me.attributes['part'].data
    V = [mw @ v.co for v in me.vertices]
    return BVHTree.FromPolygons(V, [list(p.vertices) for p in me.polygons if part[p.vertices[0]].value == 0]), V


def walk(tree, p, d, dist, step=0.004):
    """Slide `dist` metres over the coat's surface from p, starting in direction d."""
    loc, nor, _, _ = tree.find_nearest(p); p = loc; dd = d.copy()
    k = int(max(1, round(dist / step))); st = dist / k if dist > 0 else 0
    for _ in range(k):
        loc, nor, _, _ = tree.find_nearest(p); t = (dd - nor * dd.dot(nor)).normalized()
        p = tree.find_nearest(p + t * st)[0]; dd = t
    return p, tree.find_nearest(p)[1]


def front_point(tree, x, z, fy):
    h = tree.ray_cast(Vector((x, fy - 1.0, z)), Vector((0, 1, 0))); return h[0], h[1]


BUTTON = (0.22, 0.17, 0.13)   # horn buttons (vertex colour; multiplies the coat colour in the game)


def details(n, wmax=0.078, tN=0.86, depth=0.058, nrow=16, ncol=5):
    rest(n); L = land(n); s = L['s']; c = coat(n); mw = c.matrix_world; me = c.data
    tree, _ = surf(n); cx, zB, zN, e = L['cx'], L['zB'], L['zN'], L['e']; fy = L['hips'].y
    pieces = []
    def grid(rows, col=(1, 1, 1)):
        nc = len(rows[0]); vs = [p for r in rows for p in r]; fs = []
        for i in range(len(rows) - 1):
            for j in range(nc - 1):
                a = i * nc + j; fs.append((a, a + 1, a + nc + 1, a + nc))
        pieces.append((vs, fs, col))
    # notched lapels, folded back from the edges of the V
    for side in (1, -1):
        d = Vector((side * e, 0, zN - zB)).normalized(); perp = d.cross(Vector((0, 1, 0))).normalized()
        if perp.x * side < 0: perp = -perp
        rows = []
        for k in range(nrow + 1):
            t = tN * k / nrow; z = zB + (zN - zB) * t; x = cx + side * (e * t + 0.002)
            p0, _ = front_point(tree, x, z, fy)
            if p0 is None: p0 = tree.find_nearest(Vector((x, fy - 0.15, z)))[0]
            w = wmax * s * (t / tN); row = []
            for j in range(ncol):
                q, nor = walk(tree, p0, perp, w * j / (ncol - 1)); row.append(q + nor * (0.006 - 0.0025 * j / (ncol - 1)))
            rows.append(row)
        grid(rows)
    # turned-down collar round the back of the neck, from one notch to the other
    nk = L['neck']; part = me.attributes['part'].data
    bm = bmesh.new(); bm.from_mesh(me)
    ring = [mw @ v.co for v in bm.verts if v.is_boundary and part[v.index].value == 0 and (mw @ v.co).z > zN - 0.03
            and math.hypot((mw @ v.co).x - nk.x, (mw @ v.co).y - nk.y) < 0.14 * s + 0.03]
    bm.free()
    ang = lambda p: math.atan2(p.y - nk.y, p.x - nk.x)
    fA = ang(Vector((cx + e * 0.9, fy - 0.2, 0))); fB = ang(Vector((cx - e * 0.9, fy - 0.2, 0)))
    a0 = fA; a1 = fB + 2 * math.pi if fB < fA else fB; rows = []; NA = 32
    for k in range(NA + 1):
        a = a0 + (a1 - a0) * k / NA; a = (a + math.pi) % (2 * math.pi) - math.pi
        near = sorted(ring, key=lambda p: abs((ang(p) - a + math.pi) % (2 * math.pi) - math.pi))[:3]
        top = Vector((sum(p.x for p in near) / 3, sum(p.y for p in near) / 3, max(p.z for p in near)))
        out = Vector((math.cos(a), math.sin(a), 0)); dep = depth * s * min(1.0, 0.75 + 0.25 * min(k, NA - k) / 4.0)
        st = top + out * 0.01 - Vector((0, 0, 0.01)); row = [top + Vector((0, 0, 0.006 * s)) + out * 0.005]
        for j in (1, 2, 3):
            q, nor = walk(tree, st, Vector((0, 0, -1)), dep * j / 3); row.append(q + nor * (0.008 - 0.0035 * j / 3))
        rows.append(row)
    grid(rows)
    # three buttons down the closing flap
    def disc(p, nor, rad, h, col):
        nor = nor.normalized(); t1 = nor.orthogonal().normalized(); t2 = nor.cross(t1); seg = 14; vs = []; fs = []
        for rr, hh in ((rad, 0.0), (rad, h * 0.7), (rad * 0.7, h)):
            for k in range(seg):
                a = 2 * math.pi * k / seg; vs.append(p + nor * hh + (t1 * math.cos(a) + t2 * math.sin(a)) * rr)
        ctr = len(vs); vs.append(p + nor * h * 1.05)
        for r_ in range(2):
            for k in range(seg):
                a = r_ * seg + k; b = r_ * seg + (k + 1) % seg; fs.append((a, b, b + seg, a + seg))
        for k in range(seg): fs.append((2 * seg + k, 2 * seg + (k + 1) % seg, ctr))
        pieces.append((vs, fs, col))
    for k in range(3):
        p, nor = front_point(tree, cx + 0.014 * s, zB - 0.012 * s - k * 0.115 * s, fy)
        if p is not None: disc(p + nor * 0.002, nor, 0.0115 * s, 0.0045, BUTTON)
    # flap pockets on the hips: aimed straight at the coat front (walking over the front overlap twisted them)
    for side in (1, -1):
        rows = []; z0 = L['hips'].z + 0.015 * s
        for i in range(4):
            row = []
            for j in range(7):
                x = cx + side * (0.075 + 0.15 * j / 6) * s; z = z0 - 0.055 * s * i / 3 - 0.006 * s * (j / 6)
                q, nor = front_point(tree, x, z, fy)
                if q is None: q, nor = tree.find_nearest(Vector((x, fy - 0.2, z)))[:2]
                row.append(q + nor * 0.0045)
            rows.append(row)
        grid(rows, (0.93, 0.93, 0.93))
    # turn-back cuffs: a band over the last 6.5 cm of each sleeve
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table(); bm.normal_update()
    for side in ('Left', 'Right'):
        S, E, H = J(n, side + 'Arm'), J(n, side + 'ForeArm'), J(n, side + 'Hand')
        sv = [v for v in bm.verts if part[v.index].value == 1 and (intersect_point_line(mw @ v.co, E, H)[0] - mw @ v.co).length < 0.1 and ((mw @ v.co) - H).length < 0.35]
        if not sv: continue
        dmax = max(along(S, E, H, mw @ v.co) for v in sv); band = 0.065 * s
        inb = {v for v in sv if along(S, E, H, mw @ v.co) > dmax - band - 0.01}
        idx = {}; vs = []; fs = []
        for f in [f for f in bm.faces if all(v in inb for v in f.verts)]:
            tup = []
            for v in f.verts:
                if v not in idx: idx[v] = len(vs); vs.append(mw @ v.co + (mw.to_3x3() @ v.normal).normalized() * 0.0045)
                tup.append(idx[v])
            fs.append(tuple(tup))
        pieces.append((vs, fs, (0.95, 0.95, 0.95)))
    bm.free()
    old = bpy.data.objects.get('coatdetail_' + n)
    if old: bpy.data.objects.remove(old, do_unlink=True)
    md = bpy.data.meshes.new('coatdetail_' + n); allv = []; allf = []; cols = []
    for vs, fs, col in pieces:
        off = len(allv); allv += [mw.inverted() @ p for p in vs]; allf += [tuple(i + off for i in f) for f in fs]; cols += [col] * len(vs)
    md.from_pydata(allv, [], allf); md.update()
    ca = md.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for i, col in enumerate(cols): ca.data[i].color = (col[0], col[1], col[2], 1)
    for p in md.polygons: p.use_smooth = True
    ob = bpy.data.objects.new('coatdetail_' + n, md); bpy.context.scene.collection.objects.link(ob)
    ob.parent = c.parent; ob.matrix_world = c.matrix_world.copy(); ob.color = (0.3, 0.5, 0.9, 1)
    outermost(n, ob); orient(n, ob)
    return ob


def outermost(n, o, off_min=0.004):
    """Every detail vertex on the outside of the outermost coat layer under it."""
    rest(n); tree, _ = surf(n); mw = o.matrix_world; iw = mw.inverted()
    for v in o.data.vertices:
        p = mw @ v.co; loc, nor, _, _ = tree.find_nearest(p)
        if loc is None: continue
        if (p - loc).dot(nor) < 0: nor = -nor
        hit = tree.ray_cast(p + nor * 0.15, -nor)
        if hit[0] is not None and (p - hit[0]).dot(nor) < off_min: v.co = iw @ (hit[0] + nor * off_min)
    o.data.update()


def orient(n, o):
    rest(n); tree, _ = surf(n); mw = o.matrix_world
    bm = bmesh.new(); bm.from_mesh(o.data); flips = []
    for f in bm.faces:
        cc = mw @ f.calc_center_median(); loc, nor, _, _ = tree.find_nearest(cc)
        if loc is None: continue
        out = cc - loc; out = out.normalized() if out.length > 1e-6 else nor
        if (mw.to_3x3() @ f.normal).dot(out) < 0: flips.append(f)
    bmesh.ops.reverse_faces(bm, faces=flips); bm.to_mesh(o.data); bm.free()


def finish(n, coat_thick=0.006, detail_thick=0.0035):
    """Details skinned like the coat under them; wool thickness on both; white vertex colour on the coat."""
    rest(n); c = coat(n); o = bpy.data.objects['coatdetail_' + n]
    me = c.data; mw = c.matrix_world; V = [mw @ v.co for v in me.vertices]
    kd = kdtree.KDTree(len(V))
    for i, p in enumerate(V): kd.insert(p, i)
    kd.balance(); CG = {g.index: g.name for g in c.vertex_groups}
    for g in list(o.vertex_groups): o.vertex_groups.remove(g)
    for k in CG.values(): o.vertex_groups.new(name=k)
    om = o.matrix_world
    for v in o.data.vertices:
        _, j, _ = kd.find(om @ v.co)
        for g in me.vertices[j].groups: o.vertex_groups[CG[g.group]].add([v.index], g.weight, 'REPLACE')
    if not o.modifiers.get('Armature'):
        m = o.modifiers.new('Armature', 'ARMATURE'); m.object = rig(n)
    if 'Col' not in me.color_attributes:
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        for d in ca.data: d.color = (1, 1, 1, 1)
    for ob, th in ((c, coat_thick), (o, detail_thick)):
        m = ob.modifiers.get('Wool') or ob.modifiers.new('Wool', 'SOLIDIFY')
        m.thickness = th; m.offset = -1; m.use_rim = True
        m.use_even_offset = False; m.use_quality_normals = True; m.thickness_clamp = 0.5   # 'even' spiked on thin slivers
        # thickness before the armature, so it bends with the coat
        if ob.modifiers.find('Wool') > 0: ob.modifiers.move(ob.modifiers.find('Wool'), 0)


def build_all():
    for n in NAMES:
        build(n); details(n); finish(n)


# ------------------------------------------------------------------ 4. export for the game
EXPORT = {}


def export(n, tile=0.30):
    """Coat + details, evaluated at rest without the armature (so with the wool thickness), triangulated and
    split where normals/UVs differ. Binary: float32 pos(3) nrm(3) uv(2), uint8 rgb, 4 x (uint8 joint, float32
    weight), uint16 indices. Joint names listed separately. UVs: box projection, one texture tile per `tile` m."""
    rest(n); dg = bpy.context.evaluated_depsgraph_get(); verts = []; key = {}; idx = []; names = []
    def jid(k):
        k = k.replace('mixamorig:', '')
        if k not in names: names.append(k)
        return names.index(k)
    for ob in (coat(n), bpy.data.objects['coatdetail_' + n]):
        arm = ob.modifiers.get('Armature'); arm.show_viewport = False; dg.update()
        e = ob.evaluated_get(dg); m = e.to_mesh(); m.calc_loop_triangles()
        mw = ob.matrix_world; nm = mw.to_3x3()
        G = {g.index: g.name for g in ob.vertex_groups}
        col = m.color_attributes.get('Col'); cn = m.corner_normals
        for tri in m.loop_triangles:
            for li in tri.loops:
                vi = m.loops[li].vertex_index; p = mw @ m.vertices[vi].co; nr = (nm @ cn[li].vector).normalized()
                ax = max(range(3), key=lambda a: abs(nr[a]))
                u, v = [(p.y, p.z), (p.x, p.z), (p.x, p.y)][ax]; uv = (u / tile, v / tile)
                c3 = tuple(col.data[vi].color[:3]) if col else (1, 1, 1)
                k = (ob.name, vi, round(nr.x, 2), round(nr.y, 2), round(nr.z, 2), ax)
                if k not in key:
                    ws = sorted(((jid(G[g.group]), g.weight) for g in m.vertices[vi].groups if g.weight > 1e-3 and g.group in G), key=lambda x: -x[1])[:4]
                    key[k] = len(verts); verts.append((p, nr, uv, c3, ws))
                idx.append(key[k])
        e.to_mesh_clear(); arm.show_viewport = True
    b = bytearray()
    for p, nr, uv, c3, ws in verts:
        b += struct.pack('<8f', p.x, p.y, p.z, nr.x, nr.y, nr.z, uv[0], uv[1])
        b += bytes(int(max(0, min(1, x)) * 255 + 0.5) for x in c3)
        ws = ws + [(0, 0.0)] * (4 - len(ws)); t = sum(w for _, w in ws) or 1
        for j, w in ws: b += struct.pack('<Bf', j, w / t)
    nv = len(verts)
    ib = struct.pack('<%dH' % len(idx), *idx) if nv < 65536 else struct.pack('<%dI' % len(idx), *idx)
    EXPORT[n] = dict(meta=dict(n=n, nv=nv, ni=len(idx), names=names, stride=8 * 4 + 3 + 4 * 5), data=base64.b64encode(bytes(b) + ib).decode())
    return EXPORT[n]['meta']


def export_chunk(n, i, size=200000):
    d = EXPORT[n]['data']; return dict(i=i, of=(len(d) + size - 1) // size, d=d[i * size:(i + 1) * size])
