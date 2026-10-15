"""
Build the two characters with MPFB (MakeHuman for Blender) to match the art reference.

Requires Blender 4.2+ with the MPFB extension and the MakeHuman system asset pack (CC0):
  extension:  extensions.blender.org, id "mpfb"
  assets:     https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip
              (load with bpy.ops.mpfb.load_pack(filepath=...))

Run inside Blender (Text Editor, or exec via the MCP add-on), then call build_all().

Characters (from the reference shots):
- partner: early twenties, petite and slim, round youthful face, big warm eyes, freckles;
  chestnut hair in a messy bun high at the back with loose wavy strands framing the face.
- player: early twenties, tall and lean; shaggy dark-brown hair over the forehead and ears.
"""
import math
import os
import random
import sys
import importlib
import pathlib

import bpy
from mathutils import Vector


def services():
    m = lambda n, c: getattr(importlib.import_module('bl_ext.blender_org.mpfb.services.' + n), c)
    return (m('humanservice', 'HumanService'), m('targetservice', 'TargetService'),
            m('assetservice', 'AssetService'), m('locationservice', 'LocationService'))


# ---------------------------------------------------------------- Windows Store path fix
def fix_store_paths():
    """Blender from the Microsoft Store redirects AppData\\Roaming into a much longer
    LocalCache path, which pushes MPFB's target files past Windows' 260-character limit.
    Point MPFB at the real (short) Roaming path instead. Harmless elsewhere."""
    long_prefix = None
    short_prefix = os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming')
    n = 0
    for modname, mod in list(sys.modules.items()):
        if not modname.startswith('bl_ext.blender_org.mpfb'):
            continue
        for obj in [mod] + list(vars(mod).values()):
            d = getattr(obj, '__dict__', None)
            if not hasattr(d, 'items'):
                continue
            for k, v in list(d.items()):
                s = str(v) if isinstance(v, (str, pathlib.PurePath)) else None
                if s and 'LocalCache' in s and '\\Roaming\\' in s:
                    long_prefix = s[:s.index('\\Roaming') + len('\\Roaming')]
                    nv = short_prefix + s[len(long_prefix):]
                    try:
                        setattr(obj, k, type(v)(nv) if isinstance(v, pathlib.PurePath) else nv)
                        n += 1
                    except Exception:
                        pass
    return n


# ---------------------------------------------------------------- specs
SPECS = {
    'partner': dict(
        # MakeHuman age 0.5 = 25 years; anything lower blends in "child" proportions, which have no target files.
        macro=dict(gender=0.0, age=0.5, muscle=0.42, weight=0.42, proportions=0.65, height=0.32, cupsize=0.45, firmness=0.55,
                   race=dict(caucasian=0.85, asian=0.15, african=0.0)),
        skin='young_caucasian_female', brows='eyebrow010', lashes='eyelashes04', hair='ponytail01',
        face={
            'head/head-round': 0.4, 'head/head-fat-incr': 0.15, 'head/head-age-decr': 0.5,
            'eyes/*-eye-scale-incr': 0.55, 'eyes/*-eye-height2-incr': 0.35, 'eyes/*-eye-corner2-up': 0.25, 'eyes/*-eye-bag-decr': 0.4,
            'nose/nose-scale-vert-decr': 0.3, 'nose/nose-scale-horiz-decr': 0.2, 'nose/nose-point-up': 0.35, 'nose/nose-volume-decr': 0.25,
            'nose/nose-point-width-decr': 0.2,
            'mouth/mouth-upperlip-volume-incr': 0.3, 'mouth/mouth-lowerlip-volume-incr': 0.4, 'mouth/mouth-cupidsbow-incr': 0.35,
            'mouth/mouth-angles-up': 0.15,
            'cheek/*-cheek-volume-incr': 0.3, 'chin/chin-prominent-decr': 0.2, 'chin/chin-height-decr': 0.2, 'chin/chin-width-decr': 0.1,
        }),
    'player': dict(
        macro=dict(gender=1.0, age=0.5, muscle=0.5, weight=0.42, proportions=0.6, height=0.62, cupsize=0.5, firmness=0.5,
                   race=dict(caucasian=0.85, asian=0.15, african=0.0)),
        skin='young_caucasian_male', brows='eyebrow001', lashes='eyelashes02', hair='short02',
        face={
            'head/head-age-decr': 0.35, 'head/head-oval': 0.3,
            'eyes/*-eye-scale-incr': 0.2, 'eyes/*-eye-height2-incr': 0.1, 'eyes/*-eye-bag-decr': 0.3,
            'nose/nose-hump-decr': 0.3, 'nose/nose-point-up': 0.1, 'mouth/mouth-lowerlip-volume-incr': 0.15,
            'chin/chin-width-incr': 0.15, 'chin/chin-bones-incr': 0.1, 'cheek/*-cheek-bones-incr': 0.2,
        }),
}


def find_asset(AS, kind, name, ext='mhclo'):
    p = AS.find_asset_absolute_path(f'{name}/{name}.{ext}', kind)
    if p:
        return p
    for q in (AS.list_mhclo_assets(kind) if ext == 'mhclo' else AS.list_mhmat_assets(kind)):
        if os.path.basename(str(q)).startswith(name):
            return str(q)
    raise FileNotFoundError(f'{kind}/{name}')


def build_human(name, coll):
    HS, TS, AS, LS = services()
    sp = SPECS[name]
    for o in [o for o in coll.all_objects if (o.parent or o).get('cbs_role') == name]:
        bpy.data.objects.remove(o, do_unlink=True)
    bm = HS.create_human(macro_detail_dict=sp['macro'])
    bm.name = 'human_' + name
    bm['cbs_role'] = name
    HS.set_character_skin(find_asset(AS, 'skins', sp['skin'], 'mhmat'), bm, skin_type='ENHANCED_SSS')
    for kind, asset in (('eyes', 'high-poly'), ('eyebrows', sp['brows']), ('eyelashes', sp['lashes']), ('teeth', 'teeth_base'), ('hair', sp['hair'])):
        HS.add_mhclo_asset(find_asset(AS, kind, asset), bm, asset_type=kind.capitalize(), subdiv_levels=0 if kind == 'teeth' else 1,
                           material_type='MAKESKIN')
    root = LS.get_mpfb_data('targets')
    for key, w in sp['face'].items():
        cat, t = key.split('/')
        for side in (('l', 'r') if '*' in t else ('',)):
            TS.load_target(bm, os.path.join(root, cat, t.replace('*', side) + '.target.gz'), weight=w)
    HS.refit(bm)
    for c in bm.children:      # assets are fitted in place; keep them at the body's origin
        c.location = (0, 0, 0)
    return bm


# ---------------------------------------------------------------- partner's messy bun
SKULL_C = Vector((0.0, -0.046, 1.366))      # cranium centre and radii (x, depth, up), measured on the partner
SKULL_R = Vector((0.086, 0.094, 0.104))
TIE = Vector((-0.005, 0.074, 1.411))        # where ponytail01 gathers
BUN = Vector((0.0, 0.05, 1.452))            # new gathering point, high at the back of the head


def _ell(p, margin=1.0):
    d = p - SKULL_C
    return math.sqrt((d.x / (SKULL_R.x * margin)) ** 2 + (d.y / (SKULL_R.y * margin)) ** 2 + (d.z / (SKULL_R.z * margin)) ** 2)


def _push_out(p, margin=1.02):
    e = _ell(p, margin)
    return SKULL_C + (p - SKULL_C) / e if e < 1 else p


def _is_tail(p):
    return p.z < TIE.z + 0.005 and p.y > -0.02 and (p.z < 1.31 or _ell(p) > 1.07)


def ponytail_to_bun(hair_obj):
    """Pull the scalp hair up to a high gathering point and coil the tail into a loose bun."""
    me = hair_obj.data
    if 'orig_co' not in me.attributes:
        a = me.attributes.new('orig_co', 'FLOAT_VECTOR', 'POINT')
        a.data.foreach_set('vector', [c for v in me.vertices for c in v.co])
    orig = [Vector(d.vector) for d in me.attributes['orig_co'].data]
    tail = [i for i, p in enumerate(orig) if _is_tail(p)]
    zmin = min(orig[i].z for i in tail)
    axis = (BUN - Vector((0, -0.03, 1.37))).normalized()
    e1 = Vector((1, 0, 0))
    e2 = axis.cross(e1).normalized()
    e1 = e2.cross(axis).normalized()
    delta = BUN - TIE
    nb = 28

    def tparam(p):
        return max(0.0, min(0.999, (TIE.z - p.z) / (TIE.z - zmin)))
    bins = [[] for _ in range(nb)]
    for i in tail:
        bins[int(tparam(orig[i]) * nb)].append(orig[i])
    centres = [sum(b, Vector()) / len(b) if b else None for b in bins]
    for k in range(nb):
        if centres[k] is None:
            centres[k] = centres[k - 1] if k else TIE.copy()
    tailset = set(tail)
    new = []
    for i, p in enumerate(orig):
        if i in tailset:
            t = tparam(p)
            c = p - centres[int(t * nb)]
            th = 2 * math.pi * 1.9 * t + 0.6
            rad = 0.034 - 0.014 * t + 0.004 * math.sin(t * 23 + p.x * 40)
            q = BUN + (e1 * math.cos(th) + e2 * math.sin(th)) * rad + axis * (0.018 - 0.03 * t)
            q += c * 0.5
            q += Vector((math.sin(p.z * 90), math.cos(p.x * 80), math.sin(p.y * 70))) * 0.004 * t   # messiness
            new.append(_push_out(q, 1.03))
        else:
            w = math.exp(-(p - TIE).length_squared / (2 * 0.055 ** 2)) if p.y > -0.06 else 0.0
            q = p + delta * w
            new.append(_push_out(q, 1.02) if w > 0.01 else q)
    me.vertices.foreach_set('co', [c for q in new for c in q])
    me.update()
    return orig


def _bez(p0, p1, p2, p3, t):
    u = 1 - t
    return p0 * u ** 3 + p1 * 3 * u * u * t + p2 * 3 * u * t * t + p3 * t ** 3


def loose_strands(hair_obj, orig, name='loose_strands_partner', seed=4):
    """Copy real card strips from the ponytail and drape them as face-framing tendrils and hairline wisps."""
    import bmesh
    src = hair_obj
    bm = bmesh.new()
    bm.from_mesh(src.data)
    bm.faces.ensure_lookup_table()
    seen, islands = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, isl = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop()
            isl.append(g.index)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen:
                        seen.add(h.index)
                        stack.append(h)
        vs = sorted({v.index for fi in isl for v in bm.faces[fi].verts})
        if all(_is_tail(orig[i]) for i in vs):
            zs = [orig[i].z for i in vs]
            islands.append((max(zs) - min(zs), isl, vs))
    bm.free()
    islands.sort(key=lambda t: -t[0])
    paths = []
    for sd in (-1, 1):
        out = Vector((sd, -0.35, 0)).normalized()
        for (y0, z0, ze, ye, xe, w) in ((-0.104, 1.434, 1.27, -0.105, 0.058, 0.95), (-0.092, 1.43, 1.29, -0.095, 0.066, 0.85),
                                         (-0.08, 1.425, 1.31, -0.082, 0.07, 0.8), (-0.11, 1.437, 1.335, -0.122, 0.064, 0.7)):
            s = Vector((sd * 0.057, y0, z0))
            e = Vector((sd * xe, ye, ze))
            paths.append((s, s + Vector((sd * 0.026, -0.012, -0.03)), Vector((sd * (xe + 0.012), ye + 0.004, ze + 0.07)), e, w, 0.005, out))
    for x in (-0.034, -0.016, 0.012, 0.03):
        sd = 1 if x > 0 else -1
        s = Vector((x, -0.112, 1.449))
        e = Vector((x + sd * 0.024, -0.14, 1.402))
        paths.append((s, s + Vector((0, -0.022, -0.004)), e + Vector((-sd * 0.008, -0.004, 0.018)), e, 0.55, 0.002,
                      Vector((0, -1, 0.2)).normalized()))
    rng = random.Random(seed)
    uvl = src.data.uv_layers.active
    loop_uv = {(poly.index, vi): tuple(uvl.data[li].uv) for poly in src.data.polygons for li, vi in zip(poly.loop_indices, poly.vertices)}
    verts, faces, uvs = [], [], []
    for k, (p0, p1, p2, p3, wscale, wave, outdir) in enumerate(paths):
        _, fidx, vidx = islands[(k * 3) % len(islands)]
        zs = [orig[i].z for i in vidx]
        z0, z1 = max(zs), min(zs)
        rows = {}
        for i in vidx:
            rows.setdefault(round((z0 - orig[i].z) / (z0 - z1) * 18), []).append(i)
        cen = {r: sum((orig[i] for i in ids), Vector()) / len(ids) for r, ids in rows.items()}
        widest = max(rows.values(), key=len)
        wdir = orig[widest[0]] - orig[widest[-1]]
        wdir.z = 0
        wdir = wdir.normalized() if wdir.length > 1e-6 else Vector((1, 0, 0))
        ph = rng.random() * 6.28
        vmap = {}
        for i in vidx:
            t = (z0 - orig[i].z) / (z0 - z1)
            u = (orig[i] - cen[round(t * 18)]).dot(wdir)
            p = _bez(p0, p1, p2, p3, t)
            tan = (_bez(p0, p1, p2, p3, min(1, t + 0.02)) - _bez(p0, p1, p2, p3, max(0, t - 0.02))).normalized()
            side = tan.cross(outdir).normalized()
            p = p + side * u * wscale + outdir * (math.sin(ph + t * 10) * wave + 0.002)
            vmap[i] = len(verts)
            verts.append(p)
        for fi in fidx:
            poly = src.data.polygons[fi]
            faces.append([vmap[v] for v in poly.vertices])
            uvs.append([loop_uv[(fi, v)] for v in poly.vertices])
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    uv = me.uv_layers.new(name='UVMap')
    for poly, fu in zip(me.polygons, uvs):
        for j, l in enumerate(poly.loop_indices):
            uv.data[l].uv = fu[j]
        poly.use_smooth = True
    me.materials.append(src.data.materials[0])
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    ob = bpy.data.objects.new(name, me)
    for c in src.users_collection:
        c.objects.link(ob)
    ob.parent = src.parent
    ob['cbs_role'] = 'partner'
    ob.modifiers.new('sub', 'SUBSURF').levels = 1
    return ob


def build_all():
    fix_store_paths()
    sc = bpy.context.scene
    coll = bpy.data.collections.get('Humans') or bpy.data.collections.new('Humans')
    if coll.name not in sc.collection.children:
        sc.collection.children.link(coll)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[coll.name]
    out = {}
    for name in SPECS:
        bm = build_human(name, coll)
        out[name] = bm.name
    hair = bpy.data.objects['human_partner.' + SPECS['partner']['hair']]
    orig = ponytail_to_bun(hair)
    loose_strands(hair, orig)
    return out


# ---------------------------------------------------------------- hair finishing
def tint_hair(mat, color, rough=0.5, hsv=None):
    """Multiply the hair texture by a colour (and optionally shift hue/saturation/value first)."""
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    t = nt.nodes.get('cbs_tint')
    if not t:
        link = next(l for l in nt.links if l.to_socket == bsdf.inputs['Base Color'])
        t = nt.nodes.new('ShaderNodeMix')
        t.name = 'cbs_tint'
        t.data_type = 'RGBA'
        t.blend_type = 'MULTIPLY'
        src = link.from_socket
        nt.links.remove(link)
        nt.links.new(src, t.inputs[6])
        nt.links.new(t.outputs[2], bsdf.inputs['Base Color'])
    t.inputs[0].default_value = 1.0
    t.inputs[7].default_value = (*color, 1)
    if hsv:
        hs = nt.nodes.get('cbs_hsv')
        if not hs:
            hs = nt.nodes.new('ShaderNodeHueSaturation')
            hs.name = 'cbs_hsv'
            l = next(l for l in nt.links if l.to_socket == t.inputs[6])
            src = l.from_socket
            nt.links.remove(l)
            nt.links.new(src, hs.inputs['Color'])
            nt.links.new(hs.outputs['Color'], t.inputs[6])
        hs.inputs['Hue'].default_value, hs.inputs['Saturation'].default_value, hs.inputs['Value'].default_value = hsv
    bsdf.inputs['Roughness'].default_value = rough
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.3


def shag(hair_obj, centre=(0, -0.057, 1.79), radii=(0.083, 0.108, 0.1), vol=1.7, fringe=0.02, side=0.032, nape=0.03, mess=0.009, seed=3):
    """Turn the neat short02 cut into shaggy hair: more volume, longer at the sides and nape, messy clumps."""
    from mathutils import noise
    me = hair_obj.data
    if 'orig_co' not in me.attributes:
        a = me.attributes.new('orig_co', 'FLOAT_VECTOR', 'POINT')
        a.data.foreach_set('vector', [c for v in me.vertices for c in v.co])
    O = [Vector(d.vector) for d in me.attributes['orig_co'].data]
    C, R = Vector(centre), Vector(radii)
    off = Vector((seed * 1.7, seed * 2.3, seed * 0.9))
    new = []
    for p in O:
        d = p - C
        e = math.sqrt((d.x / R.x) ** 2 + (d.y / R.y) ** 2 + (d.z / R.z) ** 2)
        lift = max(0.0, e - 0.98)
        q = C + (d / e if e > 1e-6 else Vector((0, 0, 1))) * (0.98 + lift * vol + 0.012)
        tip = min(1.0, lift / 0.2)
        fw = max(0.0, -d.y / R.y - 0.45) * max(0.0, 1 - abs(d.x) / 0.075)
        q.z -= fringe * fw * (0.6 + 0.8 * noise.noise(p * 60 + off)) * (0.4 + tip)
        q.y -= 0.012 * fw * tip
        sw = max(0.0, abs(d.x) / R.x - 0.7) * (1 if d.z < 0.04 else 0.3)
        q.z -= side * sw * (0.5 + tip)
        nw = max(0.0, d.y / R.y - 0.2) * (1 if d.z < 0.0 else 0.2)
        q.z -= nape * nw * (0.5 + tip)
        q.y += 0.008 * nw * tip
        q += noise.noise_vector(p * 35 + off) * mess * (0.3 + tip)
        dq = q - C
        eq = math.sqrt((dq.x / (R.x * 1.01)) ** 2 + (dq.y / (R.y * 1.01)) ** 2 + (dq.z / (R.z * 1.01)) ** 2)
        if eq < 1 and dq.z > -0.05:
            q = C + dq / eq
        new.append(q)
    me.vertices.foreach_set('co', [c for q in new for c in q])
    me.update()


def forehead_profile(name):
    """Front surface depth (y) of the head at a few heights and offsets from the midline."""
    bm = bpy.data.objects['human_' + name]
    dg = bpy.context.evaluated_depsgraph_get()
    ev = bm.evaluated_get(dg)
    me = ev.to_mesh()
    P = [bm.matrix_world @ v.co for v in me.vertices]
    ev.to_mesh_clear()
    prof = {}
    for z in [1.76 + 0.01 * i for i in range(14)]:
        for x in (0.0, 0.03, 0.055):
            band = [p for p in P if abs(p.z - z) < 0.004 and abs(abs(p.x) - x) < 0.006 and p.y < -0.05]
            if band:
                prof[(round(z, 2), x)] = min(p.y for p in band)
    return prof


def player_fringe(strand_src, orig, islands, prof, mat, n=26, width=1.25, seed=11):
    """Strands borrowed from the ponytail asset, laid over his forehead to the brows."""
    def surf_y(x, z):
        ax = min(0.055, abs(x))

        def at(zz):
            zz = max(1.76, min(1.89, round(zz, 2)))
            vals = []
            for xx in (0.0, 0.03, 0.055):
                k = (zz, xx) if (zz, xx) in prof else min((k for k in prof if k[1] == xx), key=lambda k: abs(k[0] - zz))
                vals.append(prof[k])
            return vals[0] + (vals[1] - vals[0]) * ax / 0.03 if ax <= 0.03 else vals[1] + (vals[2] - vals[1]) * (ax - 0.03) / 0.025
        z0 = math.floor(z * 100) / 100
        f = (z - z0) / 0.01
        return at(z0) * (1 - f) + at(z0 + 0.01) * f

    def polyline(pts, t):
        seg = [(pts[i + 1] - pts[i]).length for i in range(len(pts) - 1)]
        d = t * sum(seg)
        for i, s in enumerate(seg):
            if d <= s or i == len(seg) - 1:
                return pts[i] + (pts[i + 1] - pts[i]) * (d / s if s else 0), (pts[i + 1] - pts[i]).normalized()
            d -= s
    src = strand_src
    uvl = src.data.uv_layers.active
    loop_uv = {(poly.index, vi): tuple(uvl.data[li].uv) for poly in src.data.polygons for li, vi in zip(poly.loop_indices, poly.vertices)}
    rng = random.Random(seed)
    verts, faces, uvs = [], [], []
    for k in range(n):
        layer = k % 2
        x = -0.07 + 0.14 * rng.random()
        zend = 1.768 + rng.uniform(0, 0.028) + 2.2 * x * x + layer * 0.01
        lean = rng.uniform(-0.014, 0.014) + x * 0.2
        pts = []
        for z, off in ((1.895, 0.02), (1.877, 0.018), (1.852, 0.014), (1.826, 0.012), (1.80, 0.011), (zend, 0.009)):
            zz = max(z, zend)
            t = (1.895 - zz) / (1.895 - zend)
            pts.append(Vector((x + lean * t, surf_y(x + lean * t, zz) - off - 0.003 * layer, zz)))
        _, fidx, vidx = islands[(k * 5) % len(islands)]
        zs = [orig[i].z for i in vidx]
        z0, z1 = max(zs), min(zs)
        rows = {}
        for i in vidx:
            rows.setdefault(round((z0 - orig[i].z) / (z0 - z1) * 18), []).append(i)
        cen = {r: sum((orig[i] for i in ids), Vector()) / len(ids) for r, ids in rows.items()}
        widest = max(rows.values(), key=len)
        wdir = orig[widest[0]] - orig[widest[-1]]
        wdir.z = 0
        wdir = wdir.normalized() if wdir.length > 1e-6 else Vector((1, 0, 0))
        vmap = {}
        for i in vidx:
            t = (z0 - orig[i].z) / (z0 - z1)
            u = (orig[i] - cen[round(t * 18)]).dot(wdir)
            p, tan = polyline(pts, t)
            side = tan.cross(Vector((0, -1, 0))).normalized()
            vmap[i] = len(verts)
            verts.append(p + side * u * width + Vector((0, -1, 0)) * 0.002 * math.sin(t * 9 + k))
        for fi in fidx:
            poly = src.data.polygons[fi]
            faces.append([vmap[v] for v in poly.vertices])
            uvs.append([loop_uv[(fi, v)] for v in poly.vertices])
    me = bpy.data.meshes.new('fringe_player')
    me.from_pydata(verts, [], faces)
    uv = me.uv_layers.new(name='UVMap')
    for poly, fu in zip(me.polygons, uvs):
        for j, l in enumerate(poly.loop_indices):
            uv.data[l].uv = fu[j]
        poly.use_smooth = True
    me.materials.append(mat)
    old = bpy.data.objects.get('fringe_player')
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    ob = bpy.data.objects.new('fringe_player', me)
    bpy.data.collections['Humans'].objects.link(ob)
    ob.parent = bpy.data.objects['human_player']
    ob['cbs_role'] = 'player'
    ob.modifiers.new('sub', 'SUBSURF').levels = 1
    return ob


def tail_islands(hair_obj, orig):
    import bmesh
    b = bmesh.new()
    b.from_mesh(hair_obj.data)
    b.faces.ensure_lookup_table()
    seen, islands = set(), []
    for f in b.faces:
        if f.index in seen:
            continue
        stack, isl = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop()
            isl.append(g.index)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen:
                        seen.add(h.index)
                        stack.append(h)
        vs = sorted({v.index for fi in isl for v in b.faces[fi].verts})
        if all(_is_tail(orig[i]) for i in vs):
            zs = [orig[i].z for i in vs]
            islands.append((max(zs) - min(zs), isl, vs))
    b.free()
    islands.sort(key=lambda t: -t[0])
    return islands


def finish_hair():
    """After build_all(): chestnut tone for her, shaggy dark hair with a fringe for him."""
    pony = bpy.data.objects['human_partner.ponytail01']
    tint_hair(pony.data.materials[0], (0.7, 0.58, 0.5), rough=0.55, hsv=(0.485, 0.72, 0.9))
    short = bpy.data.objects['human_player.short02']
    shag(short)
    tint_hair(short.data.materials[0], (0.28, 0.2, 0.16), rough=0.62)
    orig = [Vector(d.vector) for d in pony.data.attributes['orig_co'].data]
    mat = bpy.data.materials.get('fringe_player') or pony.data.materials[0].copy()
    mat.name = 'fringe_player'
    tint_hair(mat, (0.16, 0.11, 0.09), rough=0.6, hsv=(0.5, 1.0, 1.0))
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    al = next((l for l in nt.links if l.to_socket == bsdf.inputs['Alpha']), None)
    if al and 'cbs_alpha' not in nt.nodes:
        m = nt.nodes.new('ShaderNodeMath')
        m.name = 'cbs_alpha'
        m.operation = 'MULTIPLY'
        m.use_clamp = True
        m.inputs[1].default_value = 2.2
        src = al.from_socket
        nt.links.remove(al)
        nt.links.new(src, m.inputs[0])
        nt.links.new(m.outputs[0], bsdf.inputs['Alpha'])
    player_fringe(pony, orig, tail_islands(pony, orig), forehead_profile('player'), mat)
