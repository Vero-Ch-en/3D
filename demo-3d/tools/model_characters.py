"""
Model the two characters in Blender: anatomical bodies, five-fingered hands and
clothing, rigged to the game's skeleton.

Works in a live Blender session (objects go into a "Characters" collection and
are rebuilt in place on each run) or headless:
    bl/bin/python tools/model_characters.py            # build both, export .glb
Inside Blender's Text Editor or via the MCP add-on, exec this file, then call
    build_all(export=False)

Conventions (shared with js/people.js and tools/build_characters.py):
- Game space: x right, y up, z forward; Blender space is (x, -z, y).
- Reference height 1.75 m; the game scales each model by height / 1.75.
- Bone names: hips spine chest neck head, sh_/el_/hand_ (arms), th_/kn_/ft_ (legs), _L is −x.
- Material names the game recognises: skin, top, legs, socks (it reads the part
  before the first dot, so 'skin.partner' counts as skin).
- The game adds its own eyes, lids, brows, lips and hair to the head, so the
  head keeps the original skull proportions.
"""
import math
import os

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else os.getcwd()
OUT_DIR = os.path.join(HERE, '..', 'models')


def B(x, y, z):
    return Vector((x, -z, y))


def G(v):
    return (v.x, v.z, -v.y)


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def gauss(d2, s2):
    return math.exp(-d2 / s2)


# ---------------------------------------------------------------- joints (k = 1)
HIP_Y = 0.53 * 1.75
SPINE_Y = HIP_Y + 0.1
CHEST_Y = SPINE_Y + 0.36
NECK_Y = CHEST_Y + 0.135
HEAD = (0.0, NECK_Y + 0.155, 0.012)
SH_Y = CHEST_Y + 0.07
UA, FA = 0.186 * 1.75, 0.146 * 1.75
TL, SL = 0.245 * 1.75, 0.246 * 1.75
ANK_Y = HIP_Y - TL - SL


# ---------------------------------------------------------------- mesh building
def superellipse(a, rx, zf, zb, n):
    c, s = math.cos(a), math.sin(a)
    e = 2.0 / n
    x = rx * math.copysign(abs(c) ** e, c)
    z = (zf if s > 0 else zb) * math.copysign(abs(s) ** e, s)
    return x, z


def loft(name, coll, rings, seg=24, axis='y', cap=(True, True), sub=1):
    """Loft closed rings into a quad tube.
    axis 'y': ring = (y, cx, cz, rx, zf, zb, n)  — section in the xz plane (front depth zf, back depth zb).
    axis 'z': ring = (z, cx, cy, rx, yt, yb, n)  — section in the xy plane (top yt, bottom yb).
    """
    verts, faces = [], []
    for r in rings:
        p, c0, c1, rx, f, b, n = r
        for i in range(seg):
            a = 2 * math.pi * i / seg
            u, w = superellipse(a, rx, f, b, n)
            if axis == 'y':
                verts.append(B(c0 + u, p, c1 + w))
            else:
                verts.append(B(c0 + u, c1 + w, p))
    nr = len(rings)
    for k in range(nr - 1):
        for i in range(seg):
            a, b = k * seg + i, k * seg + (i + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    if cap[0]:
        r = rings[0]
        verts.append(B(r[1], r[0], r[2]) if axis == 'y' else B(r[1], r[2], r[0]))
        c = len(verts) - 1
        for i in range(seg):
            faces.append((c, (i + 1) % seg, i))
    if cap[1]:
        r = rings[-1]
        verts.append(B(r[1], r[0], r[2]) if axis == 'y' else B(r[1], r[2], r[0]))
        c = len(verts) - 1
        for i in range(seg):
            faces.append((c, (nr - 1) * seg + i, (nr - 1) * seg + (i + 1) % seg))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    me.update()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    # Outward normals regardless of ring order.
    centre = sum((v.co for v in me.vertices), Vector()) / len(me.vertices)
    out = sum(((sum((me.vertices[i].co for i in p.vertices), Vector()) / len(p.vertices) - centre).dot(p.normal) * p.area for p in me.polygons))
    if out < 0:
        for p in me.polygons:
            p.flip()
    if sub:
        apply_subsurf(ob, sub)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def apply_subsurf(ob, levels):
    m = ob.modifiers.new('sub', 'SUBSURF')
    m.levels = levels
    m.render_levels = levels
    dg = bpy.context.evaluated_depsgraph_get()
    new = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    old = ob.data
    ob.data = new
    bpy.data.meshes.remove(old)


def deform(ob, fn):
    for v in ob.data.vertices:
        v.co = B(*fn(*G(v.co)))
    ob.data.update()


def join(objs, name):
    objs = [o for o in objs if o]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    return ob


def material(name, char, color, rough=0.8, sheen=0.0):
    """Named '<role>.<character>'; the game reads the part before the dot (skin, top, legs, socks)."""
    full = name + '.' + char
    m = bpy.data.materials.get(full) or bpy.data.materials.new(full)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    if 'Sheen Weight' in bsdf.inputs:
        bsdf.inputs['Sheen Weight'].default_value = sheen
    m.diffuse_color = (*color, 1.0)
    return m


def set_material(ob, mat, pick=None, mats=None):
    """One material, or several chosen per face by pick(x, y, z) -> index into mats."""
    if pick is None:
        ob.data.materials.append(mat)
        return
    for m in mats:
        ob.data.materials.append(m)
    for p in ob.data.polygons:
        c = sum((ob.data.vertices[i].co for i in p.vertices), Vector()) / len(p.vertices)
        p.material_index = pick(*G(c))


# ---------------------------------------------------------------- skinning
def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.dot(ab), 1e-9)))
    return (p - (a + ab * t)).length


def weight(ob, bones, falloff=4, cutoff=0.03):
    """Blend the nearest bones by inverse distance (sharper with higher falloff)."""
    groups = {n: (ob.vertex_groups.get(n) or ob.vertex_groups.new(name=n)) for n, _, _ in bones}
    segs = [(n, Vector(h), Vector(t)) for n, h, t in bones]
    for v in ob.data.vertices:
        p = Vector(G(v.co))
        ds = sorted(((seg_dist(p, a, b), n) for n, a, b in segs))[:3]
        ws = [(1 / (d ** falloff + 1e-10), n) for d, n in ds]
        s = sum(w for w, _ in ws)
        for w, n in ws:
            if w / s >= cutoff:
                groups[n].add([v.index], w / s, 'REPLACE')


# ---------------------------------------------------------------- body parts
def build_torso(coll, P):
    """Torso from crotch to the base of the skull. P holds the per-character proportions."""
    f = P['fem']
    H = HIP_Y
    # (y, cx, cz, rx, front, back, squareness)
    rings = [
        (H - 0.145, 0, 0.0, 0.05, 0.04, 0.04, 2.0),
        (H - 0.115, 0, 0.0, P['hip'] * 0.74, 0.07, 0.085, 2.4),
        (H - 0.07, 0, -0.004, P['hip'] * 0.97, 0.082, P['glute'], 2.6),
        (H - 0.02, 0, -0.004, P['hip'], 0.085, P['glute'] * 0.96, 2.6),
        (H + 0.05, 0, -0.002, P['hip'] * 0.95, 0.083, 0.098, 2.5),
        (H + 0.11, 0, 0.0, (P['hip'] + P['waist']) / 2, 0.08, 0.086, 2.4),
        (SPINE_Y + 0.06, 0, 0.002, P['waist'], 0.078, 0.078, 2.3),
        (SPINE_Y + 0.15, 0, 0.004, (P['waist'] + P['chest']) / 2, 0.084, 0.082, 2.3),
        (CHEST_Y - 0.15, 0, 0.006, P['chest'] * 0.98, 0.092, 0.086, 2.4),
        (CHEST_Y - 0.08, 0, 0.006, P['chest'], 0.096 + P['bust'], 0.09, 2.5),
        (CHEST_Y - 0.02, 0, 0.002, P['chest'] * 1.01, 0.092, 0.092, 2.6),
        (SH_Y - 0.06, 0, -0.004, P['chest'] * 1.02, 0.088, 0.09, 2.6),
        (SH_Y - 0.03, 0, -0.006, P['shX'] + 0.03 * P['muscle'], 0.082, 0.088, 3.2),   # deltoids: the shoulder's widest point
        (SH_Y - 0.005, 0, -0.008, P['shX'] + 0.012, 0.076, 0.082, 3.0),
        (SH_Y + 0.012, 0, -0.01, P['shX'] * 0.85, 0.07, 0.078, 2.6),     # top of the shoulders
        (SH_Y + 0.03, 0, -0.012, P['trap'], 0.066, 0.074, 2.5),
        (SH_Y + 0.05, 0, -0.012, P['trap'] * 0.66, 0.058, 0.064, 2.2),
        (NECK_Y - 0.01, 0, -0.008, P['neck'] * 1.12, 0.052, 0.054, 2.0),
        (NECK_Y + 0.04, 0, 0.0, P['neck'], P['neck'] * 0.96, P['neck'], 2.0),
        (NECK_Y + 0.11, 0, 0.008, P['neck'] * 0.95, P['neck'] * 0.92, P['neck'] * 0.95, 2.0),
    ]
    ob = loft('torso', coll, rings, seg=32, sub=1)
    CY = CHEST_Y

    def shape(x, y, z):
        if f and z > 0.02:   # breasts
            for s in (-1, 1):
                z += 0.026 * gauss((x - s * 0.06) ** 2, 0.0018) * gauss((y - (CY - 0.09)) ** 2, 0.0026)
        if not f and z > 0.02:   # pectorals
            for s in (-1, 1):
                z += 0.01 * gauss((x - s * 0.065) ** 2, 0.003) * gauss((y - (CY - 0.03)) ** 2, 0.002)
        if z < -0.02:   # shoulder blades, spine groove, glute crease
            for s in (-1, 1):
                z -= 0.008 * gauss((x - s * 0.07) ** 2, 0.0025) * gauss((y - (CY - 0.02)) ** 2, 0.006)
            z += 0.006 * gauss(x * x, 0.0004) * smoothstep(H + 0.05, CY, y)
            z += 0.012 * gauss((y - (H - 0.1)) ** 2, 0.0006) * gauss(x * x, 0.0003)
        # Trapezius: a gentle slope from the neck down to the shoulder.
        if y > SH_Y - 0.01:
            y -= 0.014 * smoothstep(0.06, P['shX'], abs(x)) * smoothstep(SH_Y - 0.01, SH_Y + 0.04, y)
        return x, y, z
    deform(ob, shape)
    return ob


def build_arm(coll, P, s):
    """Upper arm and forearm with a deltoid cap; the hand is built separately."""
    x = s * P['shX']
    sy, ey, wy = SH_Y, SH_Y - UA, SH_Y - UA - FA
    o = s * 0.006   # slight outward bias of the muscle mass
    m = P['muscle']
    rings = [
        # Starts inside the torso's deltoid so the shoulder reads as one surface.
        (sy - 0.02, x - s * 0.01, -0.004, 0.03 * m, 0.032, 0.032, 2.0),
        (sy - 0.03, x, -0.002, 0.047 * m, 0.047 * m, 0.047 * m, 2.1),
        (sy - 0.06, x + o, 0.0, 0.049 * m, 0.047 * m, 0.046 * m, 2.1),
        (sy - 0.11, x + o * 0.5, 0.002, 0.045 * m, 0.046 * m, 0.044 * m, 2.1),
        (sy - 0.19, x, 0.004, 0.041 * m, 0.045 * m, 0.04 * m, 2.1),
        (ey + 0.05, x, 0.0, 0.036, 0.037, 0.036, 2.1),
        (ey + 0.0, x, -0.004, 0.034, 0.033, 0.04, 2.2),      # elbow, olecranon at the back
        (ey - 0.06, x, 0.004, 0.039 * m, 0.04 * m, 0.036 * m, 2.1),   # forearm belly
        (ey - 0.13, x, 0.004, 0.034, 0.033, 0.031, 2.2),
        (wy + 0.05, x, 0.004, 0.025, 0.027, 0.024, 2.3),
        (wy + 0.01, x, 0.004, 0.02, 0.029, 0.024, 2.5),       # wrist: deeper front-to-back than wide
        (wy - 0.012, x, 0.004, 0.018, 0.03, 0.025, 2.5),
    ]
    return loft('arm', coll, rings, seg=24, cap=(True, True), sub=1)


def build_hand(coll, P, s):
    """Relaxed hand hanging at the side, palm facing the thigh, fingers softly curled."""
    x = s * P['shX']
    wy = SH_Y - UA - FA
    h = P['hand']
    parts = []
    # Palm: a flattened block from wrist to knuckles.
    palm = loft('palm', coll, [
        (wy - 0.005, x, 0.004, 0.017 * h, 0.03 * h, 0.026 * h, 2.6),
        (wy - 0.03, x, 0.005, 0.016 * h, 0.04 * h, 0.034 * h, 3.0),
        (wy - 0.07, x - s * 0.002, 0.004, 0.014 * h, 0.042 * h, 0.036 * h, 3.0),
        (wy - 0.095 * h, x - s * 0.004, 0.003, 0.012 * h, 0.04 * h, 0.036 * h, 3.0),
    ], seg=20, sub=1)
    parts.append(palm)
    # Fingers: index (front) to little (back); lengths in metres before hand scale.
    for fz, L, r in ((0.027, 0.074, 0.0085), (0.009, 0.082, 0.0088), (-0.009, 0.077, 0.0083), (-0.026, 0.062, 0.0074)):
        z0, y0 = 0.004 + fz * h, wy - 0.09 * h
        rings, n = [], 6
        for k in range(n + 1):
            t = k / n
            curl = t * t * 0.022 * h          # tips drift toward the palm side
            fwd = t * 0.004 * (1 if fz > 0 else -1)
            rr = r * h * (1 - 0.28 * t) * (0.55 if k == n else 1)
            rings.append((y0 - L * h * t, x - s * (0.003 + curl), z0 + fwd, rr * 0.92, rr, rr, 2.0))
        parts.append(loft('finger', coll, rings, seg=10, sub=1))
    # Thumb: from the base of the palm, forward and down along the index finger.
    rings = []
    for k in range(6):
        t = k / 5
        rr = 0.011 * h * (1 - 0.3 * t) * (0.6 if k == 5 else 1)
        rings.append((wy - 0.02 * h - 0.06 * h * t, x - s * (0.008 + 0.01 * t), 0.004 + 0.034 * h + 0.012 * h * t, rr, rr, rr, 2.0))
    parts.append(loft('thumb', coll, rings, seg=10, sub=1))
    return join(parts, 'hand')


def build_leg(coll, P, s):
    x = s * P['legX']
    hy, ky = HIP_Y, HIP_Y - TL
    ay = ANK_Y
    t = P['thigh']
    i = -s * 0.008   # knees and calves sit a little inward of the hip line
    rings = [
        (hy + 0.06, x, -0.004, 0.06 * t, 0.06, 0.06, 2.0),
        (hy + 0.02, x, -0.004, 0.085 * t, 0.085 * t, 0.09 * t, 2.1),
        (hy - 0.07, x, 0.004, 0.084 * t, 0.084 * t, 0.082 * t, 2.1),
        (hy - 0.18, x + i * 0.3, 0.008, 0.075 * t, 0.076 * t, 0.07 * t, 2.1),
        (hy - 0.3, x + i * 0.6, 0.01, 0.062 * t, 0.064, 0.058, 2.1),
        (ky + 0.06, x + i, 0.01, 0.052, 0.054, 0.05, 2.2),
        (ky + 0.0, x + i, 0.012, 0.049, 0.054, 0.046, 2.3),          # knee, kneecap forward
        (ky - 0.05, x + i, 0.002, 0.047, 0.045, 0.052, 2.2),
        (ky - 0.1, x + i, -0.01, 0.051 * P['calf'], 0.04, 0.07 * P['calf'], 2.1),    # calf, bulging behind
        (ky - 0.16, x + i * 0.9, -0.01, 0.047 * P['calf'], 0.038, 0.064 * P['calf'], 2.1),
        (ky - 0.24, x + i * 0.7, -0.004, 0.037, 0.034, 0.042, 2.2),
        (ky - 0.32, x + i * 0.6, 0.0, 0.029, 0.03, 0.031, 2.2),
        (ay + 0.045, x + i * 0.5, 0.002, 0.025, 0.026, 0.028, 2.2),
        (ay + 0.01, x + i * 0.5, 0.0, 0.03, 0.03, 0.032, 2.2),      # ankle bones
    ]
    leg = loft('leg', coll, rings, seg=24, cap=(True, False), sub=1)
    fx = x + i * 0.5
    f = P['foot']
    foot = loft('foot', coll, [
        # (z, cx, cy, half-width, top, bottom, n)
        (-0.065 * f, fx, 0.045, 0.022, 0.026, 0.03, 2.0),
        (-0.05 * f, fx, 0.05, 0.03, 0.035, 0.045, 2.2),
        (-0.01 * f, fx, 0.055, 0.032, 0.034, 0.05, 2.3),
        (0.04 * f, fx + s * 0.002, 0.042, 0.036, 0.026, 0.04, 2.5),
        (0.09 * f, fx + s * 0.004, 0.028, 0.04, 0.017, 0.027, 2.6),
        (0.14 * f, fx + s * 0.002, 0.024, 0.042, 0.015, 0.023, 2.6),
        (0.175 * f, fx - s * 0.004, 0.02, 0.03, 0.012, 0.019, 2.4),
        (0.19 * f, fx - s * 0.006, 0.019, 0.012, 0.006, 0.012, 2.0),
    ], seg=20, axis='z', sub=1)
    deform(foot, lambda px, py, pz: (px, max(py, 0.0), pz))   # flat sole
    return leg, foot


def build_head(coll, P):
    """Same skull as the game's procedural face expects (eyes at ±0.031, 0.007, 0.073)."""
    me = bpy.data.meshes.new('head')
    ob = bpy.data.objects.new('head', me)
    coll.objects.link(ob)
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=56, v_segments=40, radius=1.0)
    bm.to_mesh(me)
    bm.free()
    hx, hy, hz = HEAD
    cx, cy, cz = 0.0, 0.02, -0.005
    rx, ry, rz = 0.077, 0.098, 0.094
    jaw = P['jaw']

    def shape(x, y, z):
        x, y, z = x * rx + cx, y * ry + cy, z * rz + cz
        ly = y - cy
        t = smoothstep(0.0, -ry, ly)
        x *= 1 - (1 - jaw) * t - 0.12 * t * t
        if z > 0:
            z *= 1 - 0.05 * t * t
            z += 0.012 * gauss((ly + 0.088) ** 2, 0.0004) * gauss(x * x, 0.0008)
        if z < -0.02:
            z *= 1.03
        if z > 0.04:
            z += 0.005 * gauss((y - 0.03) ** 2, 0.00012) * gauss(x * x, 0.004)
        for sd in (-1, 1):
            if z > 0.03:
                z -= 0.009 * gauss((x - sd * 0.031) ** 2 + (y - 0.007) ** 2, 0.00018)
            if z > 0.02:
                z += 0.004 * gauss((x - sd * 0.045) ** 2 / 0.0004 + (y + 0.012) ** 2 / 0.0003, 1.0)
        if z > 0.05:
            ridge = 0.015 * smoothstep(0.026, -0.026, y) * smoothstep(-0.038, -0.027, y)
            z += ridge * gauss(x * x, 2 * 0.0078 ** 2)
            z += 0.006 * math.exp(-(x * x) / (2 * 0.009 ** 2) - ((y + 0.025) ** 2) / (2 * 0.007 ** 2))
            z += 0.004 * math.exp(-(x * x) / 0.0006 - ((y + 0.054) ** 2) / 0.0002)
        return x + hx, y + hy, z + hz
    for v in me.vertices:
        gx, gy, gz = v.co.x, v.co.z, -v.co.y
        v.co = B(*shape(gx, gy, gz))
    parts = [ob]
    # Ears: a flattened shell with a rim, angled back slightly.
    for sd in (-1, 1):
        ear = loft('ear', coll, [
            (hz - 0.022, hx + sd * 0.074, hy + 0.0, 0.006, 0.006, 0.006, 2.0),
            (hz - 0.016, hx + sd * 0.077, hy + 0.003, 0.008, 0.026, 0.02, 2.0),
            (hz - 0.006, hx + sd * 0.078, hy + 0.002, 0.007, 0.024, 0.021, 2.0),
            (hz + 0.001, hx + sd * 0.075, hy - 0.002, 0.005, 0.016, 0.016, 2.0),
        ], seg=14, axis='z', sub=1)
        parts.append(ear)
    head = join(parts, 'head')
    for p in head.data.polygons:
        p.use_smooth = True
    return head


# ---------------------------------------------------------------- clothing
def sweater_shape(P):
    """Oversized cable-knit sweater: relaxed fit, soft folds, ribbed hem, cuffs and a cowl collar."""
    hem = HIP_Y - 0.12
    CY = CHEST_Y

    def fn(x, y, z):
        # Puff the knit away from the body above the hem, more where it drapes.
        r = math.hypot(x, z) + 1e-6
        loose = 0.012 + 0.012 * smoothstep(CY - 0.05, SPINE_Y, y)
        if hem - 0.01 < y < NECK_Y - 0.05:
            x += x / r * loose
            z += z / r * loose
            # Folds bunching at the waist and over the hips.
            z += 0.004 * math.sin(x * 70 + y * 12) * smoothstep(CY - 0.1, SPINE_Y, y) * (1 if z > 0 else 0.5)
        # Ribbed hem band: a slight lip.
        if hem - 0.01 < y < hem + 0.05:
            x += x / r * 0.006
            z += z / r * 0.006
            z += 0.0016 * math.sin(math.atan2(z, x) * 90) * (z / r)
        return x, y, z
    return fn


def build_cowl(coll, P):
    n = P['neck']
    cowl = loft('cowl', coll, [
        (NECK_Y - 0.055, 0, -0.008, 0.105, 0.1, 0.104, 2.0),     # spreads onto the shoulders
        (NECK_Y - 0.035, 0, -0.004, 0.1, 0.098, 0.1, 2.0),       # outer roll
        (NECK_Y - 0.012, 0, 0.0, 0.088, 0.088, 0.088, 2.0),
        (NECK_Y + 0.012, 0, 0.004, n + 0.028, n + 0.026, n + 0.028, 2.0),
        (NECK_Y + 0.035, 0, 0.006, n + 0.02, n + 0.018, n + 0.02, 2.0),
        (NECK_Y + 0.045, 0, 0.006, n + 0.012, n + 0.01, n + 0.012, 2.0),
    ], seg=36, cap=(False, False), sub=1)

    def drape(x, y, z):
        # Soft folds around the roll, deepest at the front where the knit sags.
        a = math.atan2(z, x)
        r = math.hypot(x, z) + 1e-6
        k = 0.006 * math.sin(a * 7) * smoothstep(NECK_Y + 0.02, NECK_Y - 0.03, y)
        y -= 0.012 * max(0.0, z / r) * smoothstep(NECK_Y + 0.04, NECK_Y - 0.01, y)
        return x + x / r * k, y, z + z / r * k
    deform(cowl, drape)
    return cowl


def build_hood(coll, P):
    """A hood lying down: a soft triangular drape across the upper back, its sides wrapping forward round the neck."""
    rings = []
    # (y, half-width, centre z, thickness)
    for y, w, zc, d in (
        (NECK_Y + 0.015, 0.075, -0.06, 0.022),
        (NECK_Y - 0.02, 0.112, -0.088, 0.03),
        (SH_Y - 0.005, 0.128, -0.108, 0.032),
        (SH_Y - 0.05, 0.108, -0.118, 0.028),
        (SH_Y - 0.1, 0.07, -0.12, 0.022),
        (SH_Y - 0.14, 0.028, -0.116, 0.014),
        (SH_Y - 0.16, 0.008, -0.112, 0.008),
    ):
        rings.append((y, 0, zc, w, d * 0.6, d, 2.4))
    hood = loft('hood', coll, rings, seg=32, sub=1)

    def drape(x, y, z):
        ax = abs(x)
        # Sides curl forward around the neck; the drape follows the curve of the back.
        z += 0.06 * smoothstep(0.05, 0.12, ax) * smoothstep(SH_Y - 0.06, NECK_Y, y)
        z += 0.25 * x * x
        # A centre fold and a couple of soft creases.
        z -= 0.006 * gauss(x * x, 0.0006) * smoothstep(NECK_Y, SH_Y - 0.1, y)
        z += 0.003 * math.sin(x * 70 + y * 25)
        return x, y, z
    deform(hood, drape)
    rim = loft('hood_rim', coll, [
        (NECK_Y - 0.05, 0, -0.004, 0.095, 0.09, 0.094, 2.0),
        (NECK_Y - 0.02, 0, 0.0, 0.08, 0.078, 0.082, 2.0),
        (NECK_Y + 0.005, 0, 0.004, 0.064, 0.06, 0.066, 2.0),
    ], seg=32, cap=(False, False), sub=1)
    return join([hood, rim], 'hood')


def build_pocket(coll, P):
    y0, y1 = SPINE_Y - 0.02, SPINE_Y + 0.1
    pocket = loft('pocket', coll, [
        (y0, 0, 0.0, 0.11, 0.098, 0.0, 2.4),
        (y0 + 0.01, 0, 0.0, 0.112, 0.1, 0.0, 2.4),
        (y1 - 0.01, 0, 0.0, 0.1, 0.104, 0.0, 2.4),
        (y1, 0, 0.0, 0.098, 0.1, 0.0, 2.4),
    ], seg=32, cap=(False, False), sub=1)
    # Keep only the front half; it's a patch sitting on the hoodie.
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(pocket.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().y > -0.04], context='FACES')
    bm.to_mesh(pocket.data)
    bm.free()
    return pocket


def hoodie_shape(P):
    hem = HIP_Y - 0.06
    CY = CHEST_Y

    def fn(x, y, z):
        r = math.hypot(x, z) + 1e-6
        if hem - 0.01 < y < NECK_Y - 0.06:
            loose = 0.01 + 0.012 * smoothstep(CY, SPINE_Y, y)
            x += x / r * loose
            z += z / r * loose
            z += 0.003 * math.sin(x * 55 + y * 20) * smoothstep(CY - 0.05, SPINE_Y + 0.05, y)
        if hem - 0.01 < y < hem + 0.06:       # waistband
            x += x / r * 0.005
            z += z / r * 0.005
        return x, y, z
    return fn


def sleeve_shape(P, s, outfit):
    x0 = s * P['shX']
    wy = SH_Y - UA - FA
    cuff = wy - (0.03 if outfit == 'sweater' else 0.0)

    def fn(x, y, z):
        if y > cuff:
            dx, dz = x - x0, z - 0.002
            r = math.hypot(dx, dz) + 1e-6
            loose = (0.011 if outfit == 'sweater' else 0.007) + 0.006 * smoothstep(SH_Y - UA + 0.05, SH_Y - UA - 0.1, y)
            loose *= smoothstep(cuff - 0.005, cuff + 0.03, y)
            x += dx / r * loose
            z += dz / r * loose
            # Gathered folds above the cuff and in the crook of the elbow.
            g = gauss((y - (cuff + 0.06)) ** 2, 0.0012) + 0.6 * gauss((y - (SH_Y - UA)) ** 2, 0.0015)
            x += dx / r * 0.004 * math.sin(y * 260) * g
            z += dz / r * 0.004 * math.sin(y * 260) * g
        return x, y, z
    return fn


# ---------------------------------------------------------------- assembly
SPECS = [
    dict(name='partner', fem=True, outfit='sweater', offset=0.5,
         hip=0.172, glute=0.112, waist=0.122, chest=0.136, bust=0.012, trap=0.11, neck=0.05, shX=0.16, legX=0.088,
         muscle=0.92, hand=0.93, thigh=1.0, calf=0.95, foot=0.92, jaw=0.75,
         skin=(0.80, 0.52, 0.40), top=(0.80, 0.72, 0.60), legs=(0.035, 0.03, 0.03), socks=(0.79, 0.72, 0.62)),
    dict(name='player', fem=False, outfit='hoodie', offset=-0.5,
         hip=0.158, glute=0.1, waist=0.142, chest=0.158, bust=0.0, trap=0.13, neck=0.056, shX=0.19, legX=0.086,
         muscle=1.05, hand=1.06, thigh=0.98, calf=1.0, foot=1.05, jaw=0.82,
         skin=(0.69, 0.42, 0.30), top=(0.11, 0.11, 0.12), legs=(0.03, 0.03, 0.035), socks=(0.03, 0.025, 0.02)),
]


def clear_character(name):
    coll = bpy.data.collections.get('Characters')
    if not coll:
        return
    sub = bpy.data.collections.get(name)
    if sub:
        for o in list(sub.objects):
            data = o.data
            bpy.data.objects.remove(o, do_unlink=True)
            if data and data.users == 0:
                if isinstance(data, bpy.types.Mesh):
                    bpy.data.meshes.remove(data)
                elif isinstance(data, bpy.types.Armature):
                    bpy.data.armatures.remove(data)
        bpy.data.collections.remove(sub)


def build(spec):
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    root = bpy.data.collections.get('Characters') or bpy.data.collections.new('Characters')
    if root.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(root)
    clear_character(spec['name'])
    coll = bpy.data.collections.new(spec['name'])
    root.children.link(coll)
    # Objects must be in the active layer collection for operators like join.
    lc = bpy.context.view_layer.layer_collection.children[root.name].children[coll.name]
    bpy.context.view_layer.active_layer_collection = lc

    P = spec
    outfit = spec['outfit']
    nm = spec['name']
    skin = material('skin', nm, spec['skin'], 0.5)
    top = material('top', nm, spec['top'], 0.95, sheen=0.4)
    legs = material('legs', nm, spec['legs'], 0.85, sheen=0.2)
    socks = material('socks', nm, spec['socks'], 0.95, sheen=0.3)
    hem = HIP_Y - (0.12 if outfit == 'sweater' else 0.06)

    torso = build_torso(coll, P)
    deform(torso, sweater_shape(P) if outfit == 'sweater' else hoodie_shape(P))
    neckline = NECK_Y - (0.05 if outfit == 'sweater' else 0.045)
    set_material(torso, None, lambda x, y, z: 0 if y > neckline else (1 if y > hem else 2), [skin, top, legs])
    weight(torso, [('hips', (0, HIP_Y - 0.1, 0), (0, SPINE_Y, 0)), ('spine', (0, SPINE_Y, 0), (0, CHEST_Y, 0)),
                   ('chest', (0, CHEST_Y, 0), (0, NECK_Y, 0)), ('neck', (0, NECK_Y, 0), HEAD)])
    parts = [torso]

    collar = build_cowl(coll, P) if outfit == 'sweater' else build_hood(coll, P)
    set_material(collar, top)
    weight(collar, [('chest', (0, CHEST_Y, 0), (0, NECK_Y, 0)), ('neck', (0, NECK_Y, 0), HEAD)])
    parts.append(collar)
    if outfit == 'hoodie':
        pocket = build_pocket(coll, P)
        deform(pocket, hoodie_shape(P))
        set_material(pocket, top)
        weight(pocket, [('hips', (0, HIP_Y - 0.1, 0), (0, SPINE_Y, 0)), ('spine', (0, SPINE_Y, 0), (0, CHEST_Y, 0))])
        parts.append(pocket)

    for side, s in (('L', -1), ('R', 1)):
        x = s * P['shX']
        sy, ey, wy = SH_Y, SH_Y - UA, SH_Y - UA - FA
        arm = build_arm(coll, P, s)
        deform(arm, sleeve_shape(P, s, outfit))
        cuff = wy - (0.03 if outfit == 'sweater' else 0.0)
        set_material(arm, None, lambda px, py, pz, c=cuff: 1 if py > c else 0, [skin, top])
        hand = build_hand(coll, P, s)
        set_material(hand, skin)
        both = join([arm, hand], 'arm_' + side)
        weight(both, [('sh_' + side, (x, sy, 0), (x, ey, 0)), ('el_' + side, (x, ey, 0), (x, wy, 0)),
                      ('hand_' + side, (x, wy, 0), (x, wy - 0.16, 0)), ('chest', (0, CHEST_Y, 0), (0, NECK_Y, 0))])
        parts.append(both)

        lx = s * P['legX']
        leg, foot = build_leg(coll, P, s)
        sock_top = ANK_Y + 0.06
        set_material(leg, None, lambda px, py, pz: 0 if py > sock_top else 1, [legs, socks])
        set_material(foot, socks)
        lf = join([leg, foot], 'leg_' + side)
        weight(lf, [('hips', (0, HIP_Y - 0.1, 0), (0, SPINE_Y, 0)), ('th_' + side, (lx, HIP_Y, 0), (lx, HIP_Y - TL, 0)),
                    ('kn_' + side, (lx, HIP_Y - TL, 0), (lx, ANK_Y, 0)), ('ft_' + side, (lx, ANK_Y, 0), (lx, 0.03, 0.17))])
        parts.append(lf)

    F = FACE.get(spec['name'])
    head = build_face_head(coll, P, F) if F else build_head(coll, P)
    set_material(head, skin_face_material(spec['name'], spec, F) if F else skin)
    g = head.vertex_groups.new(name='head')
    g.add([v.index for v in head.data.vertices], 1.0, 'REPLACE')
    parts.append(head)

    body = join(parts, 'body_' + spec['name'])
    # Collapse duplicate material slots from joining into one slot per name.
    by_name, order = {}, []
    for i, slot in enumerate(body.material_slots):
        n = slot.material.name
        if n not in by_name:
            by_name[n] = len(order)
            order.append(slot.material)
    remap = {i: by_name[s.material.name] for i, s in enumerate(body.material_slots)}
    idx = [remap[p.material_index] for p in body.data.polygons]
    body.data.materials.clear()
    for m in order:
        body.data.materials.append(m)
    for p, i in zip(body.data.polygons, idx):
        p.material_index = i

    # Armature with the game's joints.
    arm_data = bpy.data.armatures.new('rig_' + spec['name'])
    rig = bpy.data.objects.new('rig_' + spec['name'], arm_data)
    coll.objects.link(rig)
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    def bone(name, h, t, parent=None):
        b = eb.new(name)
        b.head = B(*h)
        b.tail = B(*t)
        if parent:
            b.parent = eb[parent]
    bone('hips', (0, HIP_Y, 0), (0, SPINE_Y, 0))
    bone('spine', (0, SPINE_Y, 0), (0, CHEST_Y, 0), 'hips')
    bone('chest', (0, CHEST_Y, 0), (0, NECK_Y, 0), 'spine')
    bone('neck', (0, NECK_Y, 0), HEAD, 'chest')
    bone('head', HEAD, (HEAD[0], HEAD[1] + 0.12, HEAD[2]), 'neck')
    for side, s in (('L', -1), ('R', 1)):
        x = s * P['shX']
        bone('sh_' + side, (x, SH_Y, 0), (x, SH_Y - UA, 0), 'chest')
        bone('el_' + side, (x, SH_Y - UA, 0), (x, SH_Y - UA - FA, 0), 'sh_' + side)
        bone('hand_' + side, (x, SH_Y - UA - FA, 0), (x, SH_Y - UA - FA - 0.15, 0), 'el_' + side)
        lx = s * P['legX']
        bone('th_' + side, (lx, HIP_Y, 0), (lx, HIP_Y - TL, 0), 'hips')
        bone('kn_' + side, (lx, HIP_Y - TL, 0), (lx, ANK_Y, 0), 'th_' + side)
        bone('ft_' + side, (lx, ANK_Y, 0), (lx, 0.03, 0.17), 'kn_' + side)
    bpy.ops.object.mode_set(mode='OBJECT')
    body.parent = rig
    mod = body.modifiers.new('rig', 'ARMATURE')
    mod.object = rig
    if F:
        build_face_and_hair(spec, coll, rig)
    # Side by side for review; the export puts the rig back at the origin.
    rig.location.x = spec.get('offset', 0.0)
    return rig, body


def export(spec, rig, body):
    """Write models/<name>.glb with the game's material names (skin, top, legs, socks)."""
    loc = rig.location.copy()
    rig.location = (0, 0, 0)
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    body.select_set(True)
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, spec['name'] + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_skins=True,
                              export_animations=False, export_normals=True, export_materials='EXPORT')
    rig.location = loc
    return path


def build_all(export_files=False, only=None):
    out = {}
    for spec in SPECS:
        if only and spec['name'] not in only:
            continue
        rig, body = build(spec)
        out[spec['name']] = {'verts': len(body.data.vertices), 'faces': len(body.data.polygons)}
        if export_files:
            out[spec['name']]['glb'] = export(spec, rig, body)
    return out


if __name__ == '__main__' and bpy.app.background:
    print(build_all(export_files=True))


# =====================================================================
# Faces and hair (rendered in Blender; the game keeps its own until we swap them in)
# =====================================================================
FACE = {
    'partner': dict(eye=1.08, iris=(0.33, 0.2, 0.1), iris2=(0.55, 0.38, 0.18), lids=(0.62, 0.4, 0.33), lips=(0.74, 0.4, 0.38),
                    blush=0.38, freckles=160, hair=(0.24, 0.14, 0.08), hair_tip=(0.42, 0.27, 0.15), style='bun', tilt=0.004),
    'player': dict(eye=1.0, iris=(0.22, 0.14, 0.08), iris2=(0.36, 0.25, 0.14), lids=(0.5, 0.32, 0.25), lips=(0.62, 0.37, 0.32),
                   blush=0.14, freckles=0, hair=(0.08, 0.055, 0.04), hair_tip=(0.17, 0.11, 0.07), style='shaggy', tilt=0.0),
}
EYE = (0.031, 0.007, 0.072)     # eye centre in head space (x mirrored)
EYE_R = 0.0122


def sock(sockets, ident):
    for sk in sockets:
        if sk.identifier == ident:
            return sk
    return sockets[ident]


def new_mat(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    out.location = (400, 0)
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return m, nt, bsdf


def image_from_array(name, arr):
    """arr: float32 (H, W, 4), row 0 at the bottom (Blender's convention)."""
    h, w = arr.shape[:2]
    img = bpy.data.images.get(name)
    if img and (img.size[0] != w or img.size[1] != h):
        bpy.data.images.remove(img)
        img = None
    img = img or bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(arr.ravel())
    img.update()
    img.pack()
    return img


# ---------- textures painted in code ----------
def strand_texture(name, seed):
    """Fine hair strands; v = 1 at the root, 0 at the tip. Grey value is tinted by the material."""
    import numpy as np
    W, H = 256, 1024
    rng = np.random.default_rng(seed)
    a = np.zeros((H, W), np.float32)
    c = np.zeros((H, W), np.float32)
    v = np.arange(H, dtype=np.float32) / (H - 1)
    for _ in range(420):
        x0 = rng.uniform(4, W - 4)
        length = rng.uniform(0.5, 1.0)
        width = rng.uniform(0.6, 2.2)
        bright = rng.uniform(0.45, 1.0)
        sway = rng.normal(0, 7)
        xs = x0 + sway * (1 - v) ** 2
        alive = v >= 1 - length
        fade = np.clip((v - (1 - length)) / 0.25, 0, 1)
        for dx in range(-3, 4):
            col = np.clip(np.round(xs + dx).astype(int), 0, W - 1)
            wgt = np.clip(1 - np.abs(xs - np.round(xs + dx)) / width, 0, 1) * fade * alive
            rows = np.arange(H)
            cur = a[rows, col]
            take = wgt > cur
            a[rows[take], col[take]] = wgt[take]
            c[rows[take], col[take]] = bright
    arr = np.zeros((H, W, 4), np.float32)
    shade = c * (0.75 + 0.25 * v[:, None])            # slightly darker toward the tips
    arr[..., 0] = arr[..., 1] = arr[..., 2] = shade
    arr[..., 3] = np.clip(a * 1.6, 0, 1)
    return image_from_array(name, arr)


FACE_BOX = (-0.08, 0.08, -0.095, 0.065)   # head-space x0, x1, y0, y1 covered by the face paint


def face_texture(name, F, seed):
    """Lips, blush, eyeshadow warmth and freckles, in a front-projected map (RGBA, A = how much paint)."""
    import numpy as np
    N = 512
    x0, x1, y0, y1 = FACE_BOX
    xs = np.linspace(x0, x1, N, dtype=np.float32)[None, :]
    ys = np.linspace(y0, y1, N, dtype=np.float32)[:, None]
    rgb = np.zeros((N, N, 3), np.float32)
    al = np.zeros((N, N), np.float32)

    def paint(mask, color, alpha):
        m = np.clip(mask, 0, 1) * alpha
        rgb[:] = rgb * (1 - m[..., None]) + np.array(color, np.float32) * m[..., None]
        al[:] = np.maximum(al, m)
    # Lips: Cupid's-bow upper lip and a fuller lower lip.
    bow = 0.0012 * np.cos(xs / 0.0085 * np.pi) * (np.abs(xs) < 0.0085)
    up = 1 - ((xs / 0.0165) ** 2 + ((ys - (-0.0505 + bow)) / 0.0042) ** 2)
    lo = 1 - ((xs / 0.0152) ** 2 + ((ys + 0.0585) / 0.0052) ** 2)
    paint(np.clip(up * 4, 0, 1), F['lips'], 0.85)
    paint(np.clip(lo * 4, 0, 1), F['lips'], 0.9)
    paint(np.clip(1 - ((xs / 0.013) ** 2 + ((ys + 0.054) / 0.0007) ** 2), 0, 1), [c * 0.55 for c in F['lips']], 0.7)   # mouth line
    # Blush on the cheeks and the tip of the nose.
    for sx in (-1, 1):
        paint(np.exp(-((xs - sx * 0.043) ** 2 + (ys + 0.018) ** 2) / 0.00022), (0.86, 0.46, 0.42), F['blush'])
        paint(np.exp(-((xs - sx * 0.031) ** 2 / 0.00016 + (ys - 0.016) ** 2 / 0.00002)), F['lids'], 0.32)   # warm lid crease
    paint(np.exp(-(xs ** 2 + (ys + 0.026) ** 2) / 0.00005), (0.84, 0.46, 0.42), F['blush'] * 0.6)
    # Freckles across the nose and upper cheeks.
    rng = np.random.default_rng(seed)
    for _ in range(F['freckles']):
        fx = rng.normal(0, 0.024)
        fy = rng.normal(-0.014, 0.008) + abs(fx) * 0.1
        if abs(fx) < 0.008 and fy > -0.012:
            continue
        r2 = rng.uniform(0.35, 0.9) * 1e-6
        paint(np.exp(-((xs - fx) ** 2 + (ys - fy) ** 2) / r2), (0.5, 0.29, 0.2), rng.uniform(0.3, 0.6))
    arr = np.zeros((N, N, 4), np.float32)
    arr[..., :3] = rgb
    arr[..., 3] = al
    return image_from_array(name, arr)


# ---------- materials ----------
def skin_face_material(name, spec, F):
    m, nt, bsdf = new_mat('face.' + name)
    bsdf.inputs['Roughness'].default_value = 0.42
    bsdf.inputs['Subsurface Weight'].default_value = 0.2
    bsdf.inputs['Subsurface Radius'].default_value = (1.0, 0.35, 0.2)
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = face_texture('face_paint_' + name, F, 7 if F['freckles'] else 3)
    tex.extension = 'CLIP'
    uv = nt.nodes.new('ShaderNodeUVMap')
    uv.uv_map = 'face'
    nt.links.new(uv.outputs['UV'], tex.inputs['Vector'])
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    sock(mix.inputs, 'A_Color').default_value = (*spec['skin'], 1)
    nt.links.new(tex.outputs['Color'], sock(mix.inputs, 'B_Color'))
    nt.links.new(tex.outputs['Alpha'], sock(mix.inputs, 'Factor_Float'))
    nt.links.new(sock(mix.outputs, 'Result_Color'), bsdf.inputs['Base Color'])
    m.diffuse_color = (*spec['skin'], 1)
    return m


def eye_material(name, F):
    """Iris, pupil and sclera from the angle off the eye's forward axis (stored as UV x)."""
    m, nt, bsdf = new_mat('eye.' + name)
    bsdf.inputs['Roughness'].default_value = 0.06
    if 'Coat Weight' in bsdf.inputs:
        bsdf.inputs['Coat Weight'].default_value = 1.0
        bsdf.inputs['Coat Roughness'].default_value = 0.02
    uv = nt.nodes.new('ShaderNodeUVMap')
    uv.uv_map = 'iris'
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(uv.outputs['UV'], sep.inputs['Vector'])
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 60
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.0, (0.01, 0.01, 0.01, 1)
    el[1].position, el[1].color = 0.05, (0.01, 0.01, 0.01, 1)
    for pos, col in ((0.058, (*F['iris'], 1)), (0.12, (*F['iris2'], 1)), (0.155, (*[c * 0.5 for c in F['iris']], 1)),
                     (0.17, (0.08, 0.06, 0.05, 1)), (0.2, (0.9, 0.86, 0.82, 1)), (0.5, (0.86, 0.76, 0.74, 1))):
        e = el.new(pos)
        e.color = col
    nt.links.new(sep.outputs['X'], ramp.inputs['Fac'])
    # Fibres in the iris: modulate brightness with noise.
    mul = nt.nodes.new('ShaderNodeMix')
    mul.data_type = 'RGBA'
    mul.blend_type = 'MULTIPLY'
    sock(mul.inputs, 'Factor_Float').default_value = 0.35
    nt.links.new(ramp.outputs['Color'], sock(mul.inputs, 'A_Color'))
    nt.links.new(noise.outputs['Color'], sock(mul.inputs, 'B_Color'))
    nt.links.new(sock(mul.outputs, 'Result_Color'), bsdf.inputs['Base Color'])
    m.diffuse_color = (0.9, 0.88, 0.85, 1)
    return m


def flat_material(name, color, rough=0.6):
    m, nt, bsdf = new_mat(name)
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    m.diffuse_color = (*color, 1)
    return m


def hair_material(name, F):
    m, nt, bsdf = new_mat('hair.' + name)
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = strand_texture('hair_strands_' + name, 11)
    tex.extension = 'CLIP'
    uvn = nt.nodes.new('ShaderNodeUVMap')
    uvn.uv_map = 'UVMap'
    nt.links.new(uvn.outputs['UV'], tex.inputs['Vector'])
    # Root-to-tip colour (sun-lit lighter ends), multiplied by the strand texture's grey.
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(uvn.outputs['UV'], sep.inputs['Vector'])
    grad = nt.nodes.new('ShaderNodeMix')
    grad.data_type = 'RGBA'
    sock(grad.inputs, 'A_Color').default_value = (*F['hair_tip'], 1)
    sock(grad.inputs, 'B_Color').default_value = (*F['hair'], 1)
    nt.links.new(sep.outputs['Y'], sock(grad.inputs, 'Factor_Float'))
    mul = nt.nodes.new('ShaderNodeMix')
    mul.data_type = 'RGBA'
    mul.blend_type = 'MULTIPLY'
    sock(mul.inputs, 'Factor_Float').default_value = 1.0
    nt.links.new(sock(grad.outputs, 'Result_Color'), sock(mul.inputs, 'A_Color'))
    nt.links.new(tex.outputs['Color'], sock(mul.inputs, 'B_Color'))
    nt.links.new(sock(mul.outputs, 'Result_Color'), bsdf.inputs['Base Color'])
    nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = 0.42
    if 'Sheen Weight' in bsdf.inputs:
        bsdf.inputs['Sheen Weight'].default_value = 0.3
    for attr, val in (('surface_render_method', 'DITHERED'), ('blend_method', 'HASHED')):
        if hasattr(m, attr):
            try:
                setattr(m, attr, val)
            except Exception:
                pass
    m.use_backface_culling = False
    m.diffuse_color = (*F['hair'], 1)
    return m


# ---------- face geometry ----------
def build_face_head(coll, P, F):
    """Higher-resolution head with the same skull as before, plus lips, nostrils and a face-paint UV map."""
    import bmesh
    me = bpy.data.meshes.new('head')
    ob = bpy.data.objects.new('head', me)
    coll.objects.link(ob)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=96, v_segments=72, radius=1.0)
    bm.to_mesh(me)
    bm.free()
    hx, hy, hz = HEAD
    cx, cy, cz = 0.0, 0.02, -0.005
    rx, ry, rz = 0.077, 0.098, 0.094
    jaw = P['jaw']
    fem = P['fem']

    def shape(x, y, z):
        x, y, z = x * rx + cx, y * ry + cy, z * rz + cz
        ly = y - cy
        t = smoothstep(0.0, -ry, ly)
        x *= 1 - (1 - jaw) * t - 0.12 * t * t
        if z > 0:
            z *= 1 - 0.05 * t * t
            z += 0.012 * gauss((ly + 0.088) ** 2, 0.0004) * gauss(x * x, 0.0008)          # chin
        if z < -0.02:
            z *= 1.03
        front = z > 0.03
        if front:
            z += (0.003 if fem else 0.005) * gauss((y - 0.03) ** 2, 0.00012) * gauss(x * x, 0.004)   # brow
            for sd in (-1, 1):
                ex = sd * EYE[0]
                z -= 0.0095 * gauss((x - ex) ** 2 + (y - EYE[1]) ** 2, 0.00019)               # eye socket
                z += (0.006 if fem else 0.004) * gauss((x - sd * 0.045) ** 2 / 0.0004 + (y + 0.014) ** 2 / 0.0003, 1)   # cheeks
                z -= 0.0015 * gauss((x - sd * 0.02) ** 2 / 0.0002 + (y + 0.04) ** 2 / 0.00015, 1)   # beside the mouth
        if z > 0.05:
            ns = 0.9 if fem else 1.0
            ridge = 0.014 * ns * smoothstep(0.024, -0.024, y) * smoothstep(-0.037, -0.027, y)
            z += ridge * gauss(x * x, 2 * 0.0072 ** 2)
            z += 0.0065 * ns * math.exp(-(x * x) / (2 * 0.0085 ** 2) - ((y + 0.026) ** 2) / (2 * 0.0065 ** 2))   # nose tip
            for sd in (-1, 1):
                z += 0.0028 * math.exp(-((x - sd * 0.0105) ** 2) / 0.00002 - ((y + 0.03) ** 2) / 0.00003)    # nostril wings
                z -= 0.002 * math.exp(-((x - sd * 0.0065) ** 2) / 0.000008 - ((y + 0.0335) ** 2) / 0.000008)  # nostrils
            z -= 0.0012 * math.exp(-(x * x) / 0.00001 - ((y + 0.043) ** 2) / 0.00002)                       # philtrum
            lips = 1.15 if fem else 0.95
            z += 0.0045 * lips * math.exp(-(x * x) / 0.00022 - ((y + 0.05) ** 2) / 0.000014)                # upper lip
            z += 0.0055 * lips * math.exp(-(x * x) / 0.0002 - ((y + 0.0585) ** 2) / 0.00002)                 # lower lip
            z -= 0.0018 * math.exp(-(x * x) / 0.00018 - ((y + 0.0542) ** 2) / 0.0000015)                      # mouth line
            z -= 0.0018 * math.exp(-(x * x) / 0.0003 - ((y + 0.067) ** 2) / 0.00002)                          # below the lip
        return x + hx, y + hy, z + hz
    for v in me.vertices:
        gx, gy, gz = v.co.x, v.co.z, -v.co.y
        v.co = B(*shape(gx, gy, gz))
    # Front-projected UVs for the face paint.
    x0, x1, y0, y1 = FACE_BOX
    uv = me.uv_layers.new(name='face')
    for loop in me.loops:
        gx, gy, gz = G(me.vertices[loop.vertex_index].co)
        if gz - hz > 0.0:
            uv.data[loop.index].uv = ((gx - hx - x0) / (x1 - x0), (gy - hy - y0) / (y1 - y0))
        else:
            uv.data[loop.index].uv = (-1, -1)
    parts = [ob]
    for sd in (-1, 1):
        parts.append(loft('ear', coll, [
            (hz - 0.022, hx + sd * 0.074, hy + 0.0, 0.006, 0.006, 0.006, 2.0),
            (hz - 0.016, hx + sd * 0.077, hy + 0.003, 0.008, 0.026, 0.02, 2.0),
            (hz - 0.006, hx + sd * 0.078, hy + 0.002, 0.007, 0.024, 0.021, 2.0),
            (hz + 0.001, hx + sd * 0.075, hy - 0.002, 0.005, 0.016, 0.016, 2.0),
        ], seg=14, axis='z', sub=1))
    head = join(parts, 'head')
    for p in head.data.polygons:
        p.use_smooth = True
    return head


def eye_frame(sd, F):
    """Eye centre and the almond-shaped opening (half-width, upper and lower height) in head space."""
    hx, hy, hz = HEAD
    c = Vector((hx + sd * EYE[0], hy + EYE[1], hz + EYE[2]))
    e = F['eye']
    return c, 0.0122 * e, 0.0066 * e, 0.0044 * e


def build_eyes(coll, F):
    import bmesh
    objs = []
    for sd in (-1, 1):
        c, ax, up, lo = eye_frame(sd, F)
        R = EYE_R * F['eye']
        me = bpy.data.meshes.new('eye')
        ob = bpy.data.objects.new('eye', me)
        coll.objects.link(ob)
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=24, radius=R)
        bm.to_mesh(me)
        bm.free()
        # Pole forward (game +z), then the iris coordinate: angle off forward / pi.
        uvl = me.uv_layers.new(name='iris')
        for v in me.vertices:
            gx, gy, gz = v.co.x, v.co.y, v.co.z          # sphere local: treat its z as "forward"
            v.co = B(c.x + gx, c.y + gy, c.z + gz)
        for loop in me.loops:
            gx, gy, gz = G(me.vertices[loop.vertex_index].co)
            d = Vector((gx - c.x, gy - c.y, gz - c.z)).normalized()
            uvl.data[loop.index].uv = (math.acos(max(-1.0, min(1.0, d.z))) / math.pi, 0.5)
        for p in me.polygons:
            p.use_smooth = True
        objs.append(ob)
    return objs


def build_lids(coll, F):
    """Lids: a shell over each eye with an almond opening cut out; lashes along the upper rim."""
    import bmesh
    lids, lashes = [], []
    tilt = F['tilt']
    for sd in (-1, 1):
        c, ax, up, lo = eye_frame(sd, F)
        R = EYE_R * F['eye'] * 1.1
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=R)
        kill = []
        for f in bm.faces:
            p = f.calc_center_median()
            lx, ly, lz = p.x, p.y, p.z
            if lz < -0.25 * R:
                kill.append(f)
                continue
            u = lx * sd                                   # + toward the outer corner
            k = max(0.0, 1 - (u / ax) ** 2)
            top = up * k ** 0.6 + tilt * (u / ax)
            bot = -lo * k ** 0.8 + tilt * 0.4 * (u / ax)
            if lz > 0 and abs(u) < ax and bot < ly < top:
                kill.append(f)
        bmesh.ops.delete(bm, geom=kill, context='FACES')
        me = bpy.data.meshes.new('lid')
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new('lid', me)
        coll.objects.link(ob)
        for v in me.vertices:
            v.co = B(c.x + v.co.x, c.y + v.co.y, c.z + v.co.z)
        for p in me.polygons:
            p.use_smooth = True
        lids.append(ob)
        # Upper lashes: a strip along the top of the opening, longer and lifted at the outer corner.
        verts, faces, n = [], [], 18
        for i in range(n + 1):
            u = -0.9 * ax + 1.85 * ax * i / n
            k = max(0.0, 1 - (u / ax) ** 2)
            y = up * k ** 0.6 + tilt * (u / ax)
            zr = math.sqrt(max(R * R - u * u - y * y, 0)) + 0.0003
            base = Vector((c.x + sd * u, c.y + y, c.z + zr))
            L = 0.0022 + 0.0022 * smoothstep(-0.2, 1.0, u / ax)
            tip = base + Vector((sd * 0.0012 * (u / ax), L * 0.9, L * 0.7))
            verts += [B(*base), B(*tip)]
            if i:
                a = 2 * (i - 1)
                faces.append((a, a + 2, a + 3, a + 1))
        me = bpy.data.meshes.new('lash')
        me.from_pydata(verts, [], faces)
        lo_ = bpy.data.objects.new('lash', me)
        coll.objects.link(lo_)
        lashes.append(lo_)
    return lids, lashes


def build_brows(coll, F, P):
    hx, hy, hz = HEAD
    objs = []
    for sd in (-1, 1):
        verts, faces, n = [], [], 14
        for i in range(n + 1):
            t = i / n
            x = 0.012 + 0.042 * t
            y = 0.027 + 0.007 * math.sin(min(1.0, t * 1.25) * math.pi * 0.85) - 0.004 * t
            z = math.sqrt(max(0.0, 1 - (x / 0.077) ** 2 - ((y - 0.02) / 0.098) ** 2)) * 0.094 - 0.005 + 0.004
            w = (0.0045 if P['fem'] else 0.0062) * (1 - 0.7 * t)
            verts += [B(hx + sd * x, hy + y + w * 0.5, hz + z), B(hx + sd * x, hy + y - w * 0.5, hz + z + 0.0005)]
            if i:
                a = 2 * (i - 1)
                faces.append((a, a + 2, a + 3, a + 1))
        me = bpy.data.meshes.new('brow')
        me.from_pydata(verts, [], faces)
        ob = bpy.data.objects.new('brow', me)
        coll.objects.link(ob)
        objs.append(ob)
    return objs


# ---------- hair ----------
SKULL = (Vector((0.0, 0.02, -0.005)), Vector((0.082, 0.103, 0.099)))


def skull_normal(p):
    c, r = SKULL
    d = p - c
    return Vector((d.x / r.x ** 2, d.y / r.y ** 2, d.z / r.z ** 2)).normalized()


def push_out(p, margin):
    c, r = SKULL
    d = p - c
    e = math.sqrt((d.x / (r.x * margin)) ** 2 + (d.y / (r.y * margin)) ** 2 + (d.z / (r.z * margin)) ** 2)
    if e < 1:
        p[:] = c + d / e


def on_skull(theta, phi):
    c, r = SKULL
    return Vector((c.x + r.x * math.cos(phi) * math.sin(theta), c.y + r.y * math.sin(phi), c.z + r.z * math.cos(phi) * math.cos(theta)))


class Cards:
    """Accumulates hair cards (strips with UV v = 1 at root) in head space."""

    def __init__(self, rng):
        self.P, self.F, self.UV = [], [], []
        self.r = rng

    def card(self, p0, d0, L, w0, grav=0.3, curl=0.15, layer=0, wave=0.0, hug=1.08, segs=9, lift=0.0, pull=None):
        r = self.r
        pts, dirs = [p0.copy()], []
        d = d0.normalized()
        q = p0.copy()
        ph = r.random() * 6.28
        for k in range(segs):
            dirs.append(d.copy())
            q = q + d * (L / segs)
            push_out(q, 1.012 + layer * 0.007)
            c, rr = SKULL
            dd = q - c
            e = math.sqrt((dd.x / rr.x) ** 2 + (dd.y / rr.y) ** 2 + (dd.z / rr.z) ** 2)
            lim = hug + layer * 0.025
            if e > lim and q.y > c.y - 0.05:      # keep the upper hair close to the head
                q = c + dd * (lim / e)
            if wave:
                q = q + Vector((math.sin(ph + k * 1.3) * wave, 0, math.cos(ph + k * 1.1) * wave * 0.6))
            pts.append(q.copy())
            nd = d + Vector((0, -grav, 0)) + Vector(((r.random() - 0.5) * curl, (r.random() - 0.5) * curl * 0.5 + lift, (r.random() - 0.5) * curl))
            if pull is not None:
                nd = nd + (pull - q).normalized() * 0.6
            d = nd.normalized()
        dirs.append(d.copy())
        base = len(self.P)
        for k, p in enumerate(pts):
            t = k / segs
            n = skull_normal(p) if (p - SKULL[0]).length < 0.17 else Vector((p.x, 0, p.z)).normalized()
            side = dirs[k].cross(n)
            if side.length < 1e-6:
                side = Vector((1, 0, 0))
            side.normalize()
            w = w0 * (1 - 0.55 * t)
            for s in (-0.5, 0.5):
                self.P.append(p + side * (s * w) + n * (0.0015 * layer))
                self.UV.append((s + 0.5, 1 - t))
            if k:
                a = base + (k - 1) * 2
                self.F.append((a, a + 2, a + 3, a + 1))

    def mesh(self, coll, name):
        hx, hy, hz = HEAD
        me = bpy.data.meshes.new(name)
        me.from_pydata([B(p.x + hx, p.y + hy, p.z + hz) for p in self.P], [], self.F)
        uv = me.uv_layers.new(name='UVMap')
        for loop in me.loops:
            uv.data[loop.index].uv = self.UV[loop.vertex_index]
        for p in me.polygons:
            p.use_smooth = True
        ob = bpy.data.objects.new(name, me)
        coll.objects.link(ob)
        return ob


def comb(p, n, crown, front_bias=0.0):
    t = p - crown
    t = t - n * t.dot(n)
    if t.length < 1e-6:
        t = Vector((0, -1, 0))
    t.normalize()
    return t * 0.9 + n * 0.3 + Vector((0, -0.25, front_bias))


def hair_bun(coll, F, seed=5):
    """Loose, messy updo: hair swept up into a bun high at the back, wavy face-framing strands, wispy bangs."""
    import random
    r = random.Random(seed)
    C = Cards(r)
    bun = Vector((0.0, 0.075, -0.098))
    for layer in range(4):
        for _ in range(150):
            th, ph = (r.random() * 2 - 1) * math.pi, -0.55 + r.random() * 2.05
            front = math.cos(th) > 0.45
            if front and ph < 0.5:
                continue
            if abs(math.sin(th)) > 0.82 and ph < 0.05 and math.cos(th) > -0.25:
                continue      # keep the ears clear
            p = on_skull(th, ph)
            to = (bun - p)
            dist = to.length
            d = to.normalized() + skull_normal(p) * 0.2
            C.card(p, d, dist * (0.95 + r.random() * 0.15), 0.026 + r.random() * 0.012, grav=0.02, curl=0.12, layer=layer,
                   hug=1.06, pull=bun)
    # The bun: cards wound round and round, loose loops poking out.
    for i in range(70):
        a = r.random() * 6.28
        b = r.random() * 3.14
        rad = 0.028 + r.random() * 0.016
        p = bun + Vector((math.cos(a) * math.sin(b) * rad, math.cos(b) * rad * 0.85, math.sin(a) * math.sin(b) * rad))
        d = Vector((-math.sin(a), (r.random() - 0.5) * 0.8, math.cos(a)))
        C.card(p, d, 0.06 + r.random() * 0.07, 0.024, grav=-0.05, curl=0.75, layer=2, hug=3.0, pull=bun + Vector((0, 0.01, 0)))
    for i in range(16):      # flyaway loops escaping the bun
        a = r.random() * 6.28
        p = bun + Vector((math.cos(a) * 0.03, 0.02 + r.random() * 0.02, math.sin(a) * 0.03))
        C.card(p, Vector((math.cos(a), 0.6, math.sin(a))), 0.05 + r.random() * 0.04, 0.008, grav=0.25, curl=1.1, layer=3, hug=3.0)
    # Face-framing strands: from the temples down past the cheeks to the jaw, wavy.
    for sd in (-1, 1):
        for j in range(9):
            th = sd * (0.62 + j * 0.06 + r.random() * 0.04)
            p = on_skull(th, 0.42 + j * 0.03 + r.random() * 0.04)
            d = Vector((sd * 0.12, -1, 0.3))
            C.card(p, d, 0.16 + r.random() * 0.07, 0.016 + r.random() * 0.008, grav=0.12, curl=0.2, layer=3,
                   wave=0.0045, hug=1.6, segs=12)
    # Wispy bangs, parted slightly off centre, falling to the brows and curving aside.
    for j in range(14):
        u = (r.random() - 0.45) * 1.1
        p = on_skull(u, 0.72 + r.random() * 0.08)
        sd = 1 if u > 0.05 else -1
        C.card(p, Vector((sd * 0.5, -0.8, 0.55)), 0.06 + r.random() * 0.04, 0.012, grav=0.18, curl=0.3, layer=3, hug=1.16, wave=0.002)
    # Nape tendrils and a few flyaways over the crown.
    for sd in (-1, 1):
        for j in range(3):
            p = on_skull(sd * (2.3 + j * 0.15), -0.35)
            C.card(p, Vector((sd * 0.1, -1, -0.3)), 0.07 + r.random() * 0.05, 0.01, grav=0.2, curl=0.3, layer=3, wave=0.003, hug=1.5)
    for j in range(12):
        p = on_skull((r.random() * 2 - 1) * 2.0, 0.9 + r.random() * 0.4)
        C.card(p, skull_normal(p) + Vector((r.random() - 0.5, 0.3, r.random() - 0.5)), 0.04 + r.random() * 0.05, 0.006,
               grav=0.25, curl=1.2, layer=3, hug=2.0)
    return C.mesh(coll, 'hair')


def hair_shaggy(coll, F, seed=9):
    """Thick, messy, shaggy hair: fringe over the forehead to the brows, over the tops of the ears, to the nape."""
    import random
    r = random.Random(seed)
    C = Cards(r)
    crown = Vector((0.0, 0.12, -0.04))
    for layer in range(5):
        for _ in range(170):
            th, ph = (r.random() * 2 - 1) * math.pi, -0.5 + r.random() * 2.0
            front = math.cos(th) > 0.5
            if front and ph < 0.52:
                continue
            if abs(math.sin(th)) > 0.85 and ph < -0.12 and math.cos(th) > -0.2:
                continue
            p = on_skull(th, ph)
            n = skull_normal(p)
            d = comb(p, n, crown, 0.35 if front else 0.0)
            if front:
                d = d + Vector((math.sin(th) * 0.4, -0.7, 0.55))     # fringe falls forward and down
            L = (0.075 + r.random() * 0.03) if front else (0.07 + r.random() * 0.06 + (0.03 if ph < 0.2 else 0))
            C.card(p, d, L, 0.022 + r.random() * 0.012, grav=0.32, curl=0.32, layer=layer, hug=1.1, wave=0.0015)
    # Chunky clumps on top for the messy, slept-on look.
    for j in range(40):
        p = on_skull((r.random() * 2 - 1) * 2.4, 0.7 + r.random() * 0.6)
        d = skull_normal(p) * 0.4 + Vector((r.random() - 0.5, 0.1, r.random() * 0.6))
        C.card(p, d, 0.05 + r.random() * 0.04, 0.02, grav=0.35, curl=0.6, layer=4, hug=1.2)
    return C.mesh(coll, 'hair')


def build_face_and_hair(spec, coll, rig):
    """Separate object 'face_<name>': eyes, lids, lashes, brows and hair, skinned to the head bone."""
    F = FACE[spec['name']]
    name = spec['name']
    skin = bpy.data.materials.get('skin.' + name)
    eye_m = eye_material(name, F)
    lash_m = flat_material('lash.' + name, (0.02, 0.015, 0.012), 0.7)
    brow_m = flat_material('brow.' + name, tuple(c * 0.9 for c in F['hair']), 0.8)
    hair_m = hair_material(name, F)
    parts = []
    eyes = build_eyes(coll, F)
    for e in eyes:
        e.data.materials.append(eye_m)
    lids, lashes = build_lids(coll, F)
    for o in lids:
        o.data.materials.append(skin)
    for o in lashes:
        o.data.materials.append(lash_m)
    brows = build_brows(coll, F, spec)
    for o in brows:
        o.data.materials.append(brow_m)
    hair = hair_bun(coll, F) if F['style'] == 'bun' else hair_shaggy(coll, F)
    hair.data.materials.append(hair_m)
    face = join(eyes + lids + lashes + brows + [hair], 'face_' + name)
    g = face.vertex_groups.new(name='head')
    g.add([v.index for v in face.data.vertices], 1.0, 'REPLACE')
    face.parent = rig
    mod = face.modifiers.new('rig', 'ARMATURE')
    mod.object = rig
    return face
