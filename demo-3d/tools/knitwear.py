"""
Knitwear for the MPFB characters: a sweater built from the wearer's own body surface.

The body is copied (with its shape keys applied), trimmed to torso and arms using MPFB's
joint markers, smoothed, loosened to hang like an oversized sweater, finished with a ribbed
hem, cuffs and collar, and textured with a generated cable-knit pattern (albedo + height).

Run inside Blender after tools/mpfb_characters.py has built the humans, then:
    build_sweater('partner')
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector

# ---------------------------------------------------------------- joints


def evaluated_body(name):
    """World-space coordinates of the basemesh with shape keys, plus the joint centres."""
    bm = bpy.data.objects['human_' + name]
    mask = bm.modifiers.get('Hide helpers')
    old = mask.show_viewport if mask else None
    if mask:
        mask.show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    ev = bm.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    if mask:
        mask.show_viewport = old
    me.transform(bm.matrix_world)
    idx = {g.index: g.name for g in bm.vertex_groups}
    acc, body = {}, set()
    for v in bm.data.vertices:
        for g in v.groups:
            n = idx[g.group]
            if n.startswith('joint-'):
                acc.setdefault(n, []).append(me.vertices[v.index].co.copy())
            elif n == 'body' and g.weight > 0.5:
                body.add(v.index)
    J = {n: sum(ps, Vector()) / len(ps) for n, ps in acc.items()}
    return me, J, body


def joint(J, *names):
    for n in names:
        if n in J:
            return J[n]
    return None


def arm_chain(J, s):
    sh = joint(J, f'joint-{s}-shoulder')
    el = joint(J, f'joint-{s}-elbow')
    wr = joint(J, f'joint-{s}-hand', f'joint-{s}-wrist')
    if wr is None:
        wr = el + (el - sh) * 0.86
    return sh, el, wr


def seg_closest(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.dot(ab)))
    return a + ab * t, t


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- knit textures


def _image(name, arr, non_color=False):
    h, w = arr.shape[:2]
    img = bpy.data.images.get(name)
    if img and (img.size[0] != w or img.size[1] != h):
        bpy.data.images.remove(img)
        img = None
    img = img or bpy.data.images.new(name, w, h, alpha=False, float_buffer=non_color)
    img.pixels.foreach_set(arr.astype(np.float32).ravel())
    img.update()
    img.pack()
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    return img


def cable_knit_height(N=1024, cols=16, rows=20):
    """One tile: purl | stockinette x2 | purl | 6-stitch cable | purl | stockinette x2 | purl | moss x2."""
    v, u = np.mgrid[0:N, 0:N].astype(np.float32)
    U = u / N * cols            # stitch columns
    V = v / N * rows            # stitch rows
    col = np.floor(U)
    fx = U - col - 0.5          # -0.5..0.5 within a column
    fy = V - np.floor(V)        # 0..1 within a row

    def stitch_v(fx, fy):
        # A knit stitch is a V of two slanted legs.
        h = np.zeros_like(fx)
        for sgn in (-1, 1):
            x = fx - sgn * 0.21
            y = fy - 0.5
            a = math.radians(28) * sgn
            xr = x * math.cos(a) - y * math.sin(a)
            yr = x * math.sin(a) + y * math.cos(a)
            h = np.maximum(h, np.sqrt(np.clip(1 - (xr / 0.24) ** 2 - (yr / 0.56) ** 2, 0, 1)))
        return h

    def purl(fx, fy):
        return 0.18 + 0.22 * np.sqrt(np.clip(1 - ((fy - 0.5) / 0.42) ** 2, 0, 1)) * np.sqrt(np.clip(1 - (fx / 0.55) ** 2, 0, 1))

    H = np.zeros((N, N), np.float32)
    layout = ['p', 'k', 'k', 'p', 'c', 'c', 'c', 'c', 'c', 'c', 'p', 'k', 'k', 'p', 'm', 'm']
    for i, kind in enumerate(layout):
        m = col == i
        if kind == 'k':
            H[m] = 0.62 * stitch_v(fx[m], fy[m])
        elif kind == 'p':
            H[m] = purl(fx[m], fy[m])
        elif kind == 'm':      # moss: alternating knit and purl bumps
            chk = ((col[m] + np.floor(V[m])) % 2) == 0
            H[m] = np.where(chk, 0.5 * stitch_v(fx[m], fy[m]), purl(fx[m], fy[m]) * 1.2)
    # Cable: two 3-stitch ropes crossing every 5 rows, raised above the rest.
    m = col.astype(int)
    cm = (m >= 4) & (m <= 9)
    mid = 7.0
    P = rows / 2.0
    phase = 2 * math.pi * V[cm] / P
    c1 = mid + 1.5 * np.cos(phase)
    c2 = mid - 1.5 * np.cos(phase)
    uu = U[cm]

    def rope(c):
        d = (uu - c) / 1.55
        prof = np.sqrt(np.clip(1 - d ** 2, 0, 1))
        # Stitches running along the rope, slanted with it.
        sx = (uu - c) / 1.5 * 1.5 + 0.5
        st = stitch_v((sx - np.floor(sx)) - 0.5, fy[cm])
        return prof * (0.75 + 0.25 * st)
    r1, r2 = rope(c1), rope(c2)
    top_first = (np.floor(V[cm] / (P / 2)) % 2) == 0
    hc = np.where(top_first, np.maximum(r1 * 1.0, r2 * 0.8), np.maximum(r2 * 1.0, r1 * 0.8))
    H[cm] = np.maximum(0.15, hc)
    return H


def rib_height(N=512, cols=8, rows=10):
    v, u = np.mgrid[0:N, 0:N].astype(np.float32)
    U = u / N * cols
    V = v / N * rows
    col = np.floor(U)
    fx = U - col - 0.5
    fy = V - np.floor(V)
    knit = (col % 2) == 0
    hk = np.sqrt(np.clip(1 - (fx / 0.5) ** 2, 0, 1)) * (0.8 + 0.2 * np.cos(2 * math.pi * fy))
    hp = 0.15 + 0.1 * np.cos(2 * math.pi * fy)
    return np.where(knit, hk, hp).astype(np.float32)


def textures(prefix, H, color, noise_seed=1):
    rng = np.random.default_rng(noise_seed)
    fuzz = rng.normal(0, 1, H.shape).astype(np.float32)
    # Cheap blur for soft woolly variation.
    for _ in range(3):
        fuzz = (fuzz + np.roll(fuzz, 1, 0) + np.roll(fuzz, -1, 0) + np.roll(fuzz, 1, 1) + np.roll(fuzz, -1, 1)) / 5
    shade = np.clip(0.7 + 0.36 * H + 0.04 * fuzz, 0, 1.05)
    alb = np.stack([shade * color[0], shade * color[1], shade * color[2], np.ones_like(H)], -1)
    hgt = np.stack([H, H, H, np.ones_like(H)], -1)
    return _image(prefix + '_albedo', alb), _image(prefix + '_height', hgt, non_color=True)


def knit_material(name, color, kind='cable', sheen=0.8):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    H = cable_knit_height() if kind == 'cable' else rib_height()
    alb, hgt = textures(name, H, color)
    uv = nt.nodes.new('ShaderNodeUVMap')
    uv.uv_map = 'knit'
    ta = nt.nodes.new('ShaderNodeTexImage')
    ta.image = alb
    th = nt.nodes.new('ShaderNodeTexImage')
    th.image = hgt
    for t in (ta, th):
        nt.links.new(uv.outputs['UV'], t.inputs['Vector'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.9
    bump.inputs['Distance'].default_value = 0.004
    nt.links.new(th.outputs['Color'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    nt.links.new(ta.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.95
    for k, v in (('Sheen Weight', sheen), ('Sheen Roughness', 0.45), ('Specular IOR Level', 0.25)):
        if k in bsdf.inputs:
            bsdf.inputs[k].default_value = v
    if 'Sheen Tint' in bsdf.inputs:
        bsdf.inputs['Sheen Tint'].default_value = (*[min(1, c * 1.2) for c in color], 1)
    m.diffuse_color = (*color, 1)
    m['height_image'] = hgt.name
    return m


# ---------------------------------------------------------------- the garment

SWEATERS = {
    # color is linear RGB
    'partner': dict(color=(0.86, 0.79, 0.66), hem_drop=0.07, loose=0.014, drape=1.0, sleeve_over_hand=0.035,
                    neck_front=-0.045, neck_back=-0.012, neck_side=-0.03, tile=0.13, kind='cable', name='top.partner'),
}


def build_sweater(name, cfg=None):
    cfg = cfg or SWEATERS[name]
    me, J, body = evaluated_body(name)
    pelvis = joint(J, 'joint-pelvis')
    neck = joint(J, 'joint-neck')
    spine1 = joint(J, 'joint-spine-1')
    arms = {s: arm_chain(J, s) for s in ('l', 'r')}
    hand_tip = {s: joint(J, f'joint-{s}-hand-3', f'joint-{s}-finger-3-3', f'joint-{s}-finger-3-1') for s in ('l', 'r')}
    hem_z = pelvis.z - 0.005          # cut just above the crotch; the hem is extended straight down later
    bust_z = spine1.z - 0.05
    axis_y = (pelvis.y + neck.y) / 2

    # Region of each body vertex: torso, or arm (side, cumulative length along the arm from the shoulder).
    region = {}
    for v in me.vertices:
        if v.index not in body:
            continue
        p = v.co
        best = ('torso', None, (Vector((0, axis_y, p.z)) - p).length / 0.14)
        for s, (sh, el, wr) in arms.items():
            for k, (a, b, rad) in enumerate(((sh, el, 0.05), (el, wr, 0.04))):
                c, t = seg_closest(p, a, b)
                d = (p - c).length / rad
                if d < best[2]:
                    best = ('arm', (s, k, t), d)
            # Past the wrist (over the hand).
            ab = wr - el
            t = (p - wr).dot(ab.normalized())
            if t > 0:
                d = (p - (wr + ab.normalized() * t)).length / 0.045
                if d < best[2]:
                    best = ('hand', (s, t), d)
        region[v.index] = best

    def keep(i):
        r = region.get(i)
        if not r:
            return False
        p = me.vertices[i].co
        if r[0] == 'torso':
            if p.z < hem_z:
                return False
            # Neckline: lower at the front, higher at the back.
            dx = abs(p.x)
            front = smoothstep(0.0, -0.06, p.y - axis_y)
            back = smoothstep(0.0, 0.05, p.y - axis_y)
            cut = neck.z + cfg['neck_side'] + front * (cfg['neck_front'] - cfg['neck_side']) * (1 - smoothstep(0.03, 0.09, dx)) \
                + back * (cfg['neck_back'] - cfg['neck_side'])
            return p.z < cut or dx > 0.1
        if r[0] == 'arm':
            return True
        if r[0] == 'hand':
            return r[1][1] < cfg['sleeve_over_hand']
        return False

    b = bmesh.new()
    b.from_mesh(me)
    b.verts.ensure_lookup_table()
    kill = [f for f in b.faces if not all(keep(v.index) for v in f.verts)]
    bmesh.ops.delete(b, geom=kill, context='FACES')
    loose_verts = [v for v in b.verts if not v.link_faces]
    bmesh.ops.delete(b, geom=loose_verts, context='VERTS')
    # Keep only the largest connected piece (drops stray islands like nipples or nails).
    b.verts.ensure_lookup_table()
    seen, pieces = set(), []
    for v in b.verts:
        if v in seen:
            continue
        stack, comp = [v], []
        seen.add(v)
        while stack:
            w = stack.pop()
            comp.append(w)
            for e in w.link_edges:
                o = e.other_vert(w)
                if o not in seen:
                    seen.add(o)
                    stack.append(o)
        pieces.append(comp)
    pieces.sort(key=len)
    for comp in pieces[:-1]:
        bmesh.ops.delete(b, geom=comp, context='VERTS')

    # Smooth away anatomy (nipples, navel, ribs) while keeping the volume.
    vs = list(b.verts)
    for _ in range(10):
        bmesh.ops.smooth_laplacian_vert(b, verts=vs, lambda_factor=0.6, lambda_border=0.0, use_x=True, use_y=True, use_z=True,
                                        preserve_volume=True)

    def classify(p):
        best = ('torso', None, (Vector((0, axis_y, p.z)) - p).length / 0.14)
        for s, (sh, el, wr) in arms.items():
            for k, (a, bb, rad) in enumerate(((sh, el, 0.05), (el, wr, 0.04))):
                c, t = seg_closest(p, a, bb)
                d = (p - c).length / rad
                if d < best[2]:
                    best = ('arm', (s, k, t), d)
            ab = (wr - el).normalized()
            t = (p - wr).dot(ab)
            if t > 0:
                d = (p - (wr + ab * t)).length / 0.045
                if d < best[2]:
                    best = ('hand', (s, t), d)
        return best

    # Oversized drape: below the bust, the sweater hangs from the widest point instead of following the waist.
    bins = 48
    env = [0.0] * bins
    reg = {v: classify(v.co) for v in b.verts}
    for v in b.verts:
        if reg[v][0] == 'torso' and abs(v.co.z - bust_z) < 0.04:
            a = math.atan2(v.co.x, v.co.y - axis_y)
            k = int((a + math.pi) / (2 * math.pi) * bins) % bins
            env[k] = max(env[k], math.hypot(v.co.x, v.co.y - axis_y))
    for _ in range(3):
        env = [max(env[k], 0.5 * (env[k - 1] + env[(k + 1) % bins])) for k in range(bins)]
    b.normal_update()
    for v in b.verts:
        kind, info, _ = reg[v]
        p = v.co
        if kind == 'torso':
            rx, ry = p.x, p.y - axis_y
            r = math.hypot(rx, ry) + 1e-9
            a = math.atan2(rx, ry)
            k = int((a + math.pi) / (2 * math.pi) * bins) % bins
            below = smoothstep(bust_z, bust_z - 0.12, p.z) * cfg['drape']
            r2 = r + (max(r, env[k] * 0.98) - r) * below
            r2 += cfg['loose'] * (0.6 + 0.8 * below)
            p.x, p.y = rx / r * r2, axis_y + ry / r * r2
            if p.z > bust_z + 0.08:
                p += v.normal * 0.004
        else:
            s = info[0]
            sh, el, wr = arms[s]
            if kind == 'arm':
                a, bb = (sh, el) if info[1] == 0 else (el, wr)
                c, t = seg_closest(p, a, bb)
                along = (t * (el - sh).length) if info[1] == 0 else ((el - sh).length + t * (wr - el).length)
            else:
                c = wr + (wr - el).normalized() * info[1]
                along = (el - sh).length + (wr - el).length + info[1]
            total = (el - sh).length + (wr - el).length
            d = p - c
            r = d.length + 1e-9
            # Baggy sleeves that widen toward the wrist, scrunched in soft rings near the cuff.
            extra = cfg['loose'] * 0.6 + 0.012 * smoothstep(0.3 * total, total, along)
            extra += 0.004 * math.sin(along * 180) * smoothstep(0.75 * total, 0.95 * total, along)
            if kind == 'hand':
                extra += 0.006
            v.co = c + d / r * (r + extra)

    # Finishing: hem dropped straight down, collar band up, cuffs gathered.
    def boundary_loops():
        edges = [e for e in b.edges if e.is_boundary]
        vset = {}
        for e in edges:
            for vv in e.verts:
                vset.setdefault(vv, []).append(e)
        loops, used = [], set()
        for e in edges:
            if e in used:
                continue
            loop, stack = [], [e]
            used.add(e)
            while stack:
                x = stack.pop()
                loop.append(x)
                for vv in x.verts:
                    for y in vset[vv]:
                        if y not in used:
                            used.add(y)
                            stack.append(y)
            loops.append(loop)
        return loops

    for loop in boundary_loops():
        verts = list({vv for e in loop for vv in e.verts})
        c = sum((vv.co for vv in verts), Vector()) / len(verts)
        kind = classify(c)[0]
        if kind == 'torso' and c.z < bust_z:
            role, steps = 'hem', [(Vector((0, 0, -cfg['hem_drop'] * 0.5)), 0.003), (Vector((0, 0, -cfg['hem_drop'] * 0.5)), -0.004)]
        elif kind == 'torso':
            role, steps = 'collar', [(Vector((0, 0, 0.012)), -0.002), (Vector((0, 0, 0.014)), -0.004), (Vector((0, 0, 0.004)), 0.004)]
        else:
            s = 'l' if c.x > 0 else 'r'
            sh, el, wr = arms[s]
            dirn = (wr - el).normalized()
            role, steps = 'cuff', [(dirn * 0.012, -0.002), (dirn * 0.01, -0.004)]
        ring = loop
        level = min(vv.co.z for vv in verts) - cfg['hem_drop']    # the hem hangs level, not following the hips
        for step_i, (off, radial) in enumerate(steps):
            res = bmesh.ops.extrude_edge_only(b, edges=ring)
            nv = [g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)]
            ring = [g for g in res['geom'] if isinstance(g, bmesh.types.BMEdge) and g.is_boundary]
            cc = sum((vv.co for vv in nv), Vector()) / len(nv)
            for vv in nv:
                d = vv.co - cc
                if role != 'cuff':
                    d.z = 0
                vv.co += off + (d.normalized() * radial if d.length > 1e-6 else Vector())
                if role == 'hem':
                    vv.co.z = level + (cfg['hem_drop'] * 0.35 if step_i == 0 else 0.0)

    out = bpy.data.meshes.new('sweater_' + name)
    b.to_mesh(out)
    b.free()
    bpy.data.meshes.remove(me)

    # Cylindrical knit UVs: around the torso / around each arm, and down the length.
    tile = cfg['tile']
    uv = out.uv_layers.new(name='knit')
    co = [v.co.copy() for v in out.vertices]
    regs = [classify(p) for p in co]

    def map_uv(p, rg):
        kind, info, _ = rg
        if kind == 'torso':
            a = math.atan2(p.x, -(p.y - axis_y))
            return ('t', a / (2 * math.pi) * round(0.86 / tile), p.z / tile)
        s = info[0]
        sh, el, wr = arms[s]
        ax = (wr - sh).normalized()
        ref = Vector((0, -1, 0))
        ref = (ref - ax * ref.dot(ax)).normalized()
        side = ax.cross(ref)
        d = p - sh
        along = d.dot(ax)
        q = d - ax * along
        a = math.atan2(q.dot(side), q.dot(ref))
        return ('a' + s, a / (2 * math.pi) * 2, -along / tile)
    for poly in out.polygons:
        ids = list(poly.vertices)
        kinds = [regs[i][0] if regs[i][0] == 'torso' else 'arm' + regs[i][1][0] for i in ids]
        major = max(set(kinds), key=kinds.count)
        rg = next(regs[i] for i, k in zip(ids, kinds) if k == major)
        uvs = [map_uv(co[i], rg)[1:] for i in ids]
        period = round(0.86 / tile) if major == 'torso' else 2
        us = [u for u, _ in uvs]
        if max(us) - min(us) > period / 2:
            uvs = [(u + period if u < 0 else u, w) for u, w in uvs]
        for li, (u, w) in zip(poly.loop_indices, uvs):
            uv.data[li].uv = (u, w)

    ob = bpy.data.objects.get('sweater_' + name)
    if ob:
        bpy.data.objects.remove(ob, do_unlink=True)
    ob = bpy.data.objects.new('sweater_' + name, out)
    bpy.data.collections['Humans'].objects.link(ob)
    ob.parent = bpy.data.objects['human_' + name]
    ob['cbs_role'] = name
    body_m = knit_material(cfg['name'], cfg['color'], cfg['kind'])
    rib_m = knit_material(cfg['name'] + '.rib', cfg['color'], 'rib')
    out.materials.append(body_m)
    out.materials.append(rib_m)
    fin_ids = set()
    bb = bmesh.new()
    bb.from_mesh(out)
    # Faces created by the finishing extrusions, plus a band next to them, get the rib knit.
    for f in bb.faces:
        c = f.calc_center_median()
        rg = classify(c)
        if rg[0] == 'torso' and (c.z < hem_z - 0.004 or c.z > neck.z + cfg['neck_side'] - 0.004):
            fin_ids.add(f.index)
        elif rg[0] in ('arm', 'hand'):
            s = rg[1][0]
            sh, el, wr = arms[s]
            if (c - sh).dot((wr - sh).normalized()) > (wr - sh).length + 0.005:
                fin_ids.add(f.index)
    bb.free()
    for p in out.polygons:
        p.use_smooth = True
        p.material_index = 1 if p.index in fin_ids else 0
    sub = ob.modifiers.new('sub', 'SUBSURF')
    sub.levels = 1
    sub.render_levels = 2
    tex = bpy.data.textures.get('knit_disp_' + name) or bpy.data.textures.new('knit_disp_' + name, 'IMAGE')
    tex.image = bpy.data.images[body_m['height_image']]
    disp = ob.modifiers.new('knit', 'DISPLACE')
    disp.texture = tex
    disp.texture_coords = 'UV'
    disp.uv_layer = 'knit'
    disp.strength = 0.006
    disp.mid_level = 0.3
    sol = ob.modifiers.new('thickness', 'SOLIDIFY')
    sol.thickness = 0.004
    sol.offset = -1
    return ob


LEGWEAR = {
    'partner': dict(color=(0.03, 0.028, 0.03), top=0.08, ankle=0.06, offset=0.0025, name='legs.partner'),
}


def build_leggings(name, cfg=None):
    """Snug leggings from the body surface: waist to just above the ankle."""
    cfg = cfg or LEGWEAR[name]
    me, J, body = evaluated_body(name)
    pelvis = joint(J, 'joint-pelvis')
    ank = [joint(J, f'joint-{s}-foot-1', f'joint-{s}-ankle') for s in ('l', 'r')]
    ank_z = max(a.z for a in ank if a is not None) if any(ank) else 0.08
    top = pelvis.z + cfg['top']
    b = bmesh.new()
    b.from_mesh(me)
    legs = [(joint(J, f'joint-{s}-upper-leg'), joint(J, f'joint-{s}-knee'), a) for s, a in zip(('l', 'r'), ank)]

    def on_leg(p):
        # Near the hips or a leg bone; hands hanging at hip height are excluded.
        if abs(p.x) < 0.2 and p.z > pelvis.z - 0.12:
            return abs(p.x) < 0.19
        return any((p - seg_closest(p, a, k)[0]).length < 0.12 or (p - seg_closest(p, k, f)[0]).length < 0.09 for a, k, f in legs)
    kill = [f for f in b.faces if not all(v.index in body and ank_z + cfg['ankle'] < v.co.z < top and on_leg(v.co) for v in f.verts)]
    bmesh.ops.delete(b, geom=kill, context='FACES')
    bmesh.ops.delete(b, geom=[v for v in b.verts if not v.link_faces], context='VERTS')
    bmesh.ops.smooth_laplacian_vert(b, verts=list(b.verts), lambda_factor=0.4, lambda_border=0.0, use_x=True, use_y=True, use_z=True,
                                    preserve_volume=True)
    b.normal_update()
    for v in b.verts:
        v.co += v.normal * cfg['offset']
    out = bpy.data.meshes.new('leggings_' + name)
    b.to_mesh(out)
    b.free()
    bpy.data.meshes.remove(me)
    ob = bpy.data.objects.get('leggings_' + name)
    if ob:
        bpy.data.objects.remove(ob, do_unlink=True)
    ob = bpy.data.objects.new('leggings_' + name, out)
    bpy.data.collections['Humans'].objects.link(ob)
    ob.parent = bpy.data.objects['human_' + name]
    ob['cbs_role'] = name
    m = bpy.data.materials.get(cfg['name']) or bpy.data.materials.new(cfg['name'])
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*cfg['color'], 1)
    bsdf.inputs['Roughness'].default_value = 0.7
    if 'Sheen Weight' in bsdf.inputs:
        bsdf.inputs['Sheen Weight'].default_value = 0.4
    m.diffuse_color = (*cfg['color'], 1)
    out.materials.append(m)
    for p in out.polygons:
        p.use_smooth = True
    ob.modifiers.new('sub', 'SUBSURF').levels = 1
    return ob
