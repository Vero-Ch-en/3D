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
