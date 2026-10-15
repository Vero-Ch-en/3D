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
        (CHEST_Y + 0.035, 0, -0.004, P['chest'] * 0.98, 0.084, 0.09, 2.6),
        (CHEST_Y + 0.08, 0, -0.01, P['trap'], 0.068, 0.078, 2.4),
        (CHEST_Y + 0.115, 0, -0.012, P['trap'] * 0.66, 0.06, 0.066, 2.2),
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
        # Trapezius slope: lower the outer top so shoulders fall away from the neck.
        if y > CY + 0.03:
            y -= 0.035 * smoothstep(0.05, P['trap'], abs(x)) * smoothstep(CY + 0.03, CY + 0.1, y)
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
        (sy + 0.05, x - s * 0.02, -0.004, 0.02, 0.02, 0.02, 2.0),
        (sy + 0.035, x - s * 0.006, -0.004, 0.044 * m, 0.046, 0.046, 2.0),
        (sy + 0.0, x + o, -0.002, 0.053 * m, 0.05 * m, 0.05 * m, 2.1),
        (sy - 0.05, x + o, 0.0, 0.051 * m, 0.048 * m, 0.047 * m, 2.1),
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
        (ky - 0.05, x + i, 0.004, 0.047, 0.046, 0.05, 2.2),
        (ky - 0.11, x + i, -0.006, 0.052 * P['calf'], 0.042, 0.062 * P['calf'], 2.1),   # calf
        (ky - 0.2, x + i * 0.8, -0.004, 0.044, 0.038, 0.048, 2.1),
        (ky - 0.3, x + i * 0.6, 0.0, 0.034, 0.032, 0.034, 2.2),
        (ay + 0.05, x + i * 0.5, 0.002, 0.028, 0.028, 0.03, 2.2),
        (ay + 0.01, x + i * 0.5, 0.0, 0.03, 0.03, 0.032, 2.2),      # ankle bones
    ]
    leg = loft('leg', coll, rings, seg=24, cap=(True, False), sub=1)
    fx = x + i * 0.5
    f = P['foot']
    foot = loft('foot', coll, [
        # (z, cx, cy, half-width, top, bottom, n)
        (-0.065 * f, fx, 0.045, 0.022, 0.026, 0.03, 2.0),
        (-0.05 * f, fx, 0.05, 0.03, 0.035, 0.045, 2.2),
        (-0.01 * f, fx, 0.06, 0.033, 0.04, 0.055, 2.3),
        (0.04 * f, fx + s * 0.002, 0.048, 0.038, 0.03, 0.045, 2.5),
        (0.09 * f, fx + s * 0.004, 0.032, 0.043, 0.02, 0.03, 2.6),
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
    return loft('cowl', coll, [
        (NECK_Y - 0.05, 0, -0.006, 0.098, 0.094, 0.098, 2.0),
        (NECK_Y - 0.02, 0, -0.002, 0.086, 0.086, 0.088, 2.0),
        (NECK_Y + 0.025, 0, 0.004, n + 0.026, n + 0.024, n + 0.026, 2.0),
        (NECK_Y + 0.07, 0, 0.006, n + 0.02, n + 0.018, n + 0.02, 2.0),
        (NECK_Y + 0.085, 0, 0.006, n + 0.012, n + 0.01, n + 0.012, 2.0),
    ], seg=32, cap=(False, False), sub=1)


def build_hood(coll, P):
    """Hood lying in folds behind the neck, opening forward around the collar."""
    rings = []
    for k, (y, w, d, zc) in enumerate((
        (NECK_Y - 0.075, 0.03, 0.012, -0.075),
        (NECK_Y - 0.055, 0.105, 0.03, -0.085),
        (NECK_Y - 0.02, 0.122, 0.05, -0.095),
        (NECK_Y + 0.025, 0.115, 0.05, -0.092),
        (NECK_Y + 0.06, 0.095, 0.038, -0.082),
        (NECK_Y + 0.08, 0.04, 0.016, -0.072),
    )):
        rings.append((y, 0, zc, w, d, d * 1.1, 2.2))
    hood = loft('hood', coll, rings, seg=28, sub=1)

    def drape(x, y, z):
        # Sides of the hood wrap forward along the collar line.
        z += 0.05 * smoothstep(0.04, 0.12, abs(x)) * smoothstep(NECK_Y + 0.07, NECK_Y - 0.04, y)
        z += 0.003 * math.sin(x * 60)   # folds
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

    head = build_head(coll, P)
    set_material(head, skin)
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
