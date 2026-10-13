"""
Build the two characters in Blender and export them as rigged glTF (.glb).

Run headless with Blender's Python module:
    python -m venv bl && bl/bin/pip install bpy
    bl/bin/python tools/build_characters.py

Each body is one continuous, subdivided mesh made with the Skin modifier from a
joint skeleton, with a separately shaped head. It is rigged to an armature whose
joints match the rig in js/people.js (reference height 1.75 m; the game scales
by height / 1.75). Coordinates below are in game space (x right, y up, z
forward) and converted to Blender space (x, -z, y) on creation.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models')


def B(x, y, z):
    """Game space -> Blender space."""
    return Vector((x, -z, y))


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1.0)
    m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*color, 1.0)
    return m


def skin_object(name, nodes, edges, root=0):
    """nodes: list of (x, y, z, radius) in game space. Returns an evaluated, subdivided mesh object."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([B(*n[:3]) for n in nodes], edges, [])
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    sk = ob.modifiers.new('skin', 'SKIN')
    sk.use_smooth_shade = True
    for i, n in enumerate(nodes):
        sv = me.skin_vertices[0].data[i]
        sv.radius = (n[3], n[3])
        sv.use_root = (i == root)
    sub = ob.modifiers.new('sub', 'SUBSURF')
    sub.levels = 2
    sub.render_levels = 2
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    new = bpy.data.meshes.new_from_object(ev)
    ob.modifiers.clear()
    old = ob.data
    ob.data = new
    bpy.data.meshes.remove(old)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def loft(name, rings, axis='y', seg=18, cap=True):
    """rings: list of (cx, cy, cz, ra, rb). axis 'y': ring in the xz plane (ra = x radius, rb = z radius);
    axis 'z': ring in the xy plane (ra = x radius, rb = y radius). Closed with end caps, then subdivided twice."""
    verts, faces = [], []
    for (cx, cy, cz, ra, rb) in rings:
        for i in range(seg):
            a = 2 * math.pi * i / seg
            if axis == 'y':
                verts.append(B(cx + math.cos(a) * ra, cy, cz + math.sin(a) * rb))
            else:
                verts.append(B(cx + math.cos(a) * ra, cy + math.sin(a) * rb, cz))
    n = len(rings)
    for r in range(n - 1):
        for i in range(seg):
            a, b = r * seg + i, r * seg + (i + 1) % seg
            c, d = b + seg, a + seg
            faces.append((a, b, c, d))
    if cap:
        verts.append(B(*rings[0][:3])); c0 = len(verts) - 1
        verts.append(B(*rings[-1][:3])); c1 = len(verts) - 1
        for i in range(seg):
            faces.append((c0, (i + 1) % seg, i))
            faces.append((c1, (n - 1) * seg + i, (n - 1) * seg + (i + 1) % seg))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    # Make normals point outward regardless of ring winding.
    centre = sum((v.co for v in me.vertices), Vector()) / len(me.vertices)
    out = sum(((sum((me.vertices[i].co for i in p.vertices), Vector()) / len(p.vertices) - centre).dot(p.normal) for p in me.polygons))
    if out < 0:
        for p in me.polygons:
            p.flip()
    sub = ob.modifiers.new('sub', 'SUBSURF')
    sub.levels = 1
    dg = bpy.context.evaluated_depsgraph_get()
    new = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    old = ob.data
    ob.data = new
    bpy.data.meshes.remove(old)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def game(v):
    """Blender space -> game space."""
    return (v.x, v.z, -v.y)


def deform(ob, fn):
    for v in ob.data.vertices:
        x, y, z = game(v.co)
        x, y, z = fn(x, y, z)
        v.co = B(x, y, z)


def assign_materials(ob, mats, pick):
    for m in mats:
        ob.data.materials.append(m)
    for p in ob.data.polygons:
        c = sum((ob.data.vertices[i].co for i in p.vertices), Vector()) / len(p.vertices)
        p.material_index = pick(*game(c))


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.dot(ab), 1e-9)))
    return (p - (a + ab * t)).length


def weight(ob, bones):
    """bones: list of (name, head_game, tail_game). Two-bone blend by inverse distance."""
    groups = {n: ob.vertex_groups.new(name=n) for n, _, _ in bones}
    segs = [(n, Vector(h), Vector(t)) for n, h, t in bones]
    for v in ob.data.vertices:
        p = Vector(game(v.co))
        ds = sorted(((seg_dist(p, a, b), n) for n, a, b in segs))
        (d0, n0) = ds[0]
        if len(ds) > 1:
            (d1, n1) = ds[1]
            w0, w1 = 1 / (d0 ** 4 + 1e-9), 1 / (d1 ** 4 + 1e-9)
            s = w0 + w1
            w0, w1 = w0 / s, w1 / s
            if w1 < 0.04:
                groups[n0].add([v.index], 1.0, 'REPLACE')
            else:
                groups[n0].add([v.index], w0, 'REPLACE')
                groups[n1].add([v.index], w1, 'REPLACE')
        else:
            groups[n0].add([v.index], 1.0, 'REPLACE')


def build(spec):
    reset()
    fem = spec['fem']
    W = dict(hip=0.172, waist=0.13, chest=0.155, sh=0.16, shX=0.16) if fem else dict(hip=0.162, waist=0.15, chest=0.18, sh=0.19, shX=0.19)
    # Joint positions (match js/people.js at k = 1).
    HIP_Y = 0.53 * 1.75
    SPINE_Y = HIP_Y + 0.1
    CHEST_Y = SPINE_Y + 0.36
    NECK_Y = CHEST_Y + 0.135
    HEAD = (0.0, NECK_Y + 0.155, 0.012)
    SH_Y = CHEST_Y + 0.07
    UA, FA = 0.186 * 1.75, 0.146 * 1.75
    TL, SL = 0.245 * 1.75, 0.246 * 1.75
    LEGX = 0.088 if fem else 0.086

    skin = material('skin', spec['skin'])
    top = material('top', spec['top'])
    legs = material('legs', spec['legs'])
    socks = material('socks', spec['socks'])
    parts = []

    # ---------- torso + neck ----------
    bust = 0.012 if fem else 0.0
    zr = 0.7 if fem else 0.66
    torso = loft('torso', [
        (0, HIP_Y - 0.13, 0.0, 0.07, 0.06),
        (0, HIP_Y - 0.1, 0.0, W['hip'] * 0.86, 0.095),
        (0, HIP_Y - 0.04, 0.0, W['hip'] * 0.98, 0.108),
        (0, HIP_Y + 0.02, 0.0, W['hip'], 0.11),
        (0, HIP_Y + 0.1, 0.0, (W['hip'] + W['waist']) / 2, 0.1),
        (0, SPINE_Y + 0.06, 0.004, W['waist'], 0.095),
        (0, SPINE_Y + 0.2, 0.004, (W['waist'] + W['chest']) / 2, 0.104),
        (0, CHEST_Y - 0.08, 0.006, W['chest'] + bust, W['chest'] * zr + bust * 0.6),
        (0, CHEST_Y + 0.0, 0.0, W['chest'] * 1.03, W['chest'] * zr * 0.98),
        (0, CHEST_Y + 0.06, -0.008, W['sh'] * 1.0, 0.098),
        (0, CHEST_Y + 0.105, -0.012, W['sh'] * 0.72, 0.082),
        (0, NECK_Y - 0.02, -0.004, 0.06, 0.056),
        (0, NECK_Y + 0.03, 0.004, 0.051, 0.05),
        (0, NECK_Y + 0.12, 0.012, 0.047, 0.046),
    ])

    def torso_shape(x, y, z):
        if fem and z > 0:
            for s in (-1, 1):
                z += 0.02 * math.exp(-((x - s * 0.058) ** 2 / 0.0016 + (y - (CHEST_Y - 0.085)) ** 2 / 0.0028))
        if z < 0 and HIP_Y - 0.12 < y < HIP_Y + 0.06:
            z -= 0.016 * math.exp(-((abs(x) - 0.068) ** 2) / 0.0025)
        return x, y, z
    deform(torso, torso_shape)
    # Collar (sweater: soft cowl; hoodie: crew neck plus the bunched hood).
    if spec['outfit'] == 'sweater':
        collar = loft('collar', [(0, NECK_Y - 0.045, -0.004, 0.085, 0.078), (0, NECK_Y - 0.005, 0.0, 0.08, 0.074), (0, NECK_Y + 0.035, 0.004, 0.066, 0.062), (0, NECK_Y + 0.05, 0.004, 0.06, 0.057)], cap=False)
    else:
        collar = loft('collar', [(0, NECK_Y - 0.045, -0.006, 0.078, 0.07), (0, NECK_Y - 0.01, -0.002, 0.066, 0.062), (0, NECK_Y + 0.005, 0.0, 0.06, 0.057)], cap=False)
        hood = loft('hood', [(0, NECK_Y - 0.07, -0.085, 0.02, 0.015), (0, NECK_Y - 0.05, -0.088, 0.1, 0.04), (0, NECK_Y + 0.0, -0.09, 0.115, 0.055), (0, NECK_Y + 0.05, -0.08, 0.1, 0.045), (0, NECK_Y + 0.075, -0.07, 0.03, 0.02)])
        bpy.ops.object.select_all(action='DESELECT')
        collar.select_set(True); hood.select_set(True)
        bpy.context.view_layer.objects.active = collar
        bpy.ops.object.join()
    collar.data.materials.append(top)
    weight(collar, [('chest', (0, CHEST_Y, 0), (0, NECK_Y, 0)), ('neck', (0, NECK_Y, 0), HEAD)])
    parts.append(collar)
    hem = HIP_Y - (0.13 if spec['outfit'] == 'sweater' else 0.07) + 0.1
    assign_materials(torso, [skin, top, legs], lambda x, y, z: 0 if y > NECK_Y - 0.025 else (1 if y > hem else 2))
    weight(torso, [('hips', (0, HIP_Y - 0.1, 0), (0, SPINE_Y, 0)), ('spine', (0, SPINE_Y, 0), (0, CHEST_Y, 0)), ('chest', (0, CHEST_Y, 0), (0, NECK_Y, 0)), ('neck', (0, NECK_Y, 0), HEAD)])
    parts.append(torso)

    # ---------- arms ----------
    cuff = -FA - (0.035 if spec['outfit'] == 'sweater' else -0.01)
    for side, s in (('L', -1), ('R', 1)):
        x = s * W['shX']
        sy, ey, wy = SH_Y, SH_Y - UA, SH_Y - UA - FA
        sl = 1.1 if spec['outfit'] == 'sweater' else 1.0
        rings = [
            (x, sy + 0.045, -0.004, 0.025, 0.025),
            (x, sy + 0.025, -0.004, 0.047 * sl, 0.047 * sl),
            (x, sy - 0.02, -0.002, 0.05 * sl, 0.05 * sl),
            (x, sy - 0.1, 0, 0.047 * sl, 0.046 * sl),
            (x, sy - 0.2, 0, 0.043 * sl, 0.042 * sl),
            (x, ey + 0.01, 0, 0.037 * sl, 0.036 * sl),
            (x, ey - 0.07, 0.002, 0.038 * sl, 0.037 * sl),
            (x, ey - 0.17, 0.002, 0.033 * sl, 0.031 * sl),
            (x, wy + 0.02, 0, 0.027, 0.025),
            (x, wy - 0.01, 0.003, 0.023, 0.028),
            (x, wy - 0.045, 0.006, 0.017, 0.036),
            (x, wy - 0.085, 0.006, 0.016, 0.035),
            (x, wy - 0.125, 0.004, 0.012, 0.027),
            (x, wy - 0.16, 0.002, 0.006, 0.012),
        ]
        arm = loft('arm' + side, rings)
        thumb = loft('thumb' + side, [(x - s * 0.004, wy - 0.012, 0.03, 0.012, 0.012), (x - s * 0.006, wy - 0.04, 0.042, 0.011, 0.011), (x - s * 0.006, wy - 0.07, 0.046, 0.009, 0.009), (x - s * 0.005, wy - 0.088, 0.045, 0.006, 0.006)])
        bpy.ops.object.select_all(action='DESELECT')
        arm.select_set(True); thumb.select_set(True)
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.join()
        assign_materials(arm, [skin, top], lambda px, py, pz, ey=ey: 1 if py > ey + cuff + UA * 0 and py > SH_Y - UA + cuff else 0)
        weight(arm, [('sh_' + side, (x, sy, 0), (x, ey, 0)), ('el_' + side, (x, ey, 0), (x, wy, 0)), ('hand_' + side, (x, wy, 0), (x, wy - 0.16, 0))])
        parts.append(arm)

    # ---------- legs ----------
    for side, s in (('L', -1), ('R', 1)):
        x = s * LEGX
        hy, ky, ay = HIP_Y, HIP_Y - TL, HIP_Y - TL - SL
        leg = loft('leg' + side, [
            (x, hy + 0.05, 0, 0.06, 0.06),
            (x, hy + 0.02, 0, 0.085, 0.085),
            (x, hy - 0.06, 0.004, 0.083, 0.08),
            (x, hy - 0.2, 0.006, 0.072, 0.07),
            (x, hy - 0.34, 0.008, 0.058, 0.056),
            (x, ky + 0.02, 0.01, 0.05, 0.05),
            (x, ky - 0.08, -0.004, 0.051, 0.054),
            (x, ky - 0.2, -0.004, 0.044, 0.045),
            (x, ay + 0.06, 0, 0.034, 0.034),
            (x, ay + 0.0, 0, 0.033, 0.033),
            (x, ay - 0.025, 0, 0.022, 0.022),
        ])
        foot = loft('foot' + side, [
            (x, 0.035, -0.058, 0.018, 0.02),
            (x, 0.042, -0.04, 0.031, 0.036),
            (x, 0.052, 0.01, 0.038, 0.046),
            (x, 0.038, 0.08, 0.042, 0.032),
            (x, 0.03, 0.15, 0.038, 0.024),
            (x, 0.025, 0.19, 0.016, 0.012),
        ], axis='z')
        bpy.ops.object.select_all(action='DESELECT')
        leg.select_set(True); foot.select_set(True)
        bpy.context.view_layer.objects.active = leg
        bpy.ops.object.join()

        def foot_shape(px, py, pz):
            return px, max(py, 0.0), pz
        deform(leg, foot_shape)
        assign_materials(leg, [legs, socks], lambda px, py, pz: 0 if py > ay + 0.035 else 1)
        weight(leg, [('th_' + side, (x, hy, 0), (x, ky, 0)), ('kn_' + side, (x, ky, 0), (x, ay, 0)), ('ft_' + side, (x, ay, 0), (x, 0.03, 0.17))])
        parts.append(leg)

    # ---------- head ----------
    bpy.ops.mesh.primitive_uv_sphere_add(segments=56, ring_count=40, radius=1.0)
    head = bpy.context.active_object
    head.name = 'head'
    hx, hy, hz = HEAD
    cx, cy, cz = 0.0, 0.02, -0.005
    rx, ry, rz = 0.077, 0.098, 0.094
    jaw = 0.75 if fem else 0.82

    def head_shape(x, y, z):
        # unit sphere -> skull ellipsoid in head space
        x, y, z = x * rx + cx, y * ry + cy, z * rz + cz
        ly = y - cy
        # Jaw taper and chin
        t = smoothstep(0.0, -ry, ly)
        x *= 1 - (1 - jaw) * t - 0.12 * t * t
        if z > 0:
            z *= 1 - 0.05 * t * t
            z += 0.012 * math.exp(-((ly + 0.088) ** 2) / 0.0004) * math.exp(-(x ** 2) / 0.0008)
        # Flatten the sides of the face slightly, fuller back of the skull
        if z < -0.02:
            z *= 1.03
        # Brow ridge
        if z > 0.04:
            z += 0.005 * math.exp(-((y - 0.03) ** 2) / 0.00012) * math.exp(-(x ** 2) / 0.004)
        # Eye sockets
        for s in (-1, 1):
            g = math.exp(-((x - s * 0.031) ** 2 + (y - 0.007) ** 2) / 0.00018)
            if z > 0.03:
                z -= 0.009 * g
        # Cheekbones
        for s in (-1, 1):
            g = math.exp(-((x - s * 0.045) ** 2 / 0.0004 + (y + 0.012) ** 2 / 0.0003))
            if z > 0.02:
                z += 0.004 * g
        # Nose: a ridge from the brow down to a rounded tip.
        if z > 0.05:
            ridge = 0.015 * smoothstep(0.026, -0.026, y) * smoothstep(-0.038, -0.027, y)
            z += ridge * math.exp(-(x ** 2) / (2 * 0.0078 ** 2))
            z += 0.006 * math.exp(-(x ** 2) / (2 * 0.009 ** 2) - ((y + 0.025) ** 2) / (2 * 0.007 ** 2))
        # Lips area forward, philtrum
        if z > 0.05:
            z += 0.004 * math.exp(-(x ** 2) / 0.0006 - ((y + 0.054) ** 2) / 0.0002)
        return x + hx, y + hy, z + hz
    for v in head.data.vertices:
        gx, gy, gz = v.co.x, v.co.z, -v.co.y
        v.co = B(*head_shape(gx, gy, gz))
    # Ears
    for s in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, radius=1.0)
        ear = bpy.context.active_object
        for v in ear.data.vertices:
            gx, gy, gz = v.co.x, v.co.z, -v.co.y
            v.co = B(hx + s * 0.075 + gx * 0.011, hy + 0.0 + gy * 0.024, hz - 0.008 + gz * 0.017)
        head.select_set(True)
        ear.select_set(True)
        bpy.context.view_layer.objects.active = head
        bpy.ops.object.join()
    for p in head.data.polygons:
        p.use_smooth = True
    head.data.materials.append(skin)
    g = head.vertex_groups.new(name='head')
    g.add([v.index for v in head.data.vertices], 1.0, 'REPLACE')
    parts.append(head)

    # ---------- join body ----------
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    body = bpy.context.active_object
    body.name = 'body'
    # Merge duplicate materials created by joining.
    names = {}
    for i, slot in enumerate(body.material_slots):
        base = slot.material.name.split('.')[0]
        names.setdefault(base, i)
    remap = {i: names[s.material.name.split('.')[0]] for i, s in enumerate(body.material_slots)}
    for p in body.data.polygons:
        p.material_index = remap[p.material_index]

    # ---------- armature ----------
    arm_data = bpy.data.armatures.new('rig')
    rig = bpy.data.objects.new('rig', arm_data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    def bone(name, h, t, parent=None):
        b = eb.new(name)
        b.head = B(*h)
        b.tail = B(*t)
        if parent:
            b.parent = eb[parent]
        return b
    bone('hips', (0, HIP_Y, 0), (0, SPINE_Y, 0))
    bone('spine', (0, SPINE_Y, 0), (0, CHEST_Y, 0), 'hips')
    bone('chest', (0, CHEST_Y, 0), (0, NECK_Y, 0), 'spine')
    bone('neck', (0, NECK_Y, 0), HEAD, 'chest')
    bone('head', HEAD, (HEAD[0], HEAD[1] + 0.12, HEAD[2]), 'neck')
    for side, s in (('L', -1), ('R', 1)):
        x = s * W['shX']
        bone('sh_' + side, (x, SH_Y, 0), (x, SH_Y - UA, 0), 'chest')
        bone('el_' + side, (x, SH_Y - UA, 0), (x, SH_Y - UA - FA, 0), 'sh_' + side)
        bone('hand_' + side, (x, SH_Y - UA - FA, 0), (x, SH_Y - UA - FA - 0.15, 0), 'el_' + side)
        lx = s * LEGX
        bone('th_' + side, (lx, HIP_Y, 0), (lx, HIP_Y - TL, 0), 'hips')
        bone('kn_' + side, (lx, HIP_Y - TL, 0), (lx, HIP_Y - TL - SL, 0), 'th_' + side)
        bone('ft_' + side, (lx, HIP_Y - TL - SL, 0), (lx, 0.03, 0.17), 'kn_' + side)
    bpy.ops.object.mode_set(mode='OBJECT')
    body.parent = rig
    mod = body.modifiers.new('rig', 'ARMATURE')
    mod.object = rig

    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, spec['name'] + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_skins=True, export_animations=False, export_normals=True, export_materials='EXPORT', use_selection=False)
    print('wrote', path, len(body.data.vertices), 'verts')


SPECS = [
    dict(name='player', fem=False, outfit='hoodie', skin=(0.69, 0.42, 0.30), top=(0.06, 0.06, 0.07), legs=(0.02, 0.02, 0.025), socks=(0.03, 0.025, 0.02)),
    dict(name='partner', fem=True, outfit='sweater', skin=(0.80, 0.52, 0.40), top=(0.75, 0.66, 0.53), legs=(0.03, 0.025, 0.025), socks=(0.79, 0.72, 0.62)),
]

if __name__ == '__main__':
    only = sys.argv[1:] or [s['name'] for s in SPECS]
    for spec in SPECS:
        if spec['name'] in only:
            build(spec)


def write_models_js():
    """Embed the .glb files in js/models.js so the game also runs from file:// without a server."""
    import base64
    out = ['// Generated by tools/build_characters.py. Do not edit by hand.', 'window.CBS_MODELS = {']
    for spec in SPECS:
        p = os.path.join(OUT_DIR, spec['name'] + '.glb')
        if os.path.exists(p):
            with open(p, 'rb') as f:
                out.append(f"  {spec['name']}: '{base64.b64encode(f.read()).decode()}',")
    out.append('};')
    with open(os.path.join(OUT_DIR, '..', 'js', 'models.js'), 'w') as f:
        f.write('\n'.join(out) + '\n')


if __name__ == '__main__':
    write_models_js()
