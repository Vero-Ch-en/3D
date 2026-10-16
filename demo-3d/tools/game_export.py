"""
Get the MPFB characters ready for the game, and export them as GLB.

Run inside Blender on a COPY of the look-dev file (prepare() saves one next to it first),
after mpfb_characters.py and knitwear.py have built the two characters:

    prepare()          # save-as copy, rig, weights, socks, game materials, arms-down rest pose
    export_all(folder) # one .glb per character

What the game needs (see demo-3d/js/people.js, G.attachBlenderBody):
- a skeleton it can recognise: MPFB's Mixamo rig ("mixamorig:Hips", "LeftArm", "LeftForeArm"...);
- the same rest pose as the game's own rig: standing straight, ARMS HANGING DOWN, not MPFB's A-pose,
  because each bone copies the motion of a game rig joint relative to that rest pose;
- plain materials (base colour textures, alpha-clipped hair), modest textures, and a sensible
  triangle count (the close-up knit detail is for renders only);
- feet: they're barefoot in the renders, so they get socks.
"""
import importlib
import os

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector, kdtree

NAMES = ('partner', 'player')
SOCKS = {'partner': (0.84, 0.8, 0.72), 'player': (0.13, 0.125, 0.12)}
DROP = ('teeth',)                      # never seen in the game
TEX = {'skin': 1024, 'hair': 1024, 'eye': 256, 'small': 256, 'knit': 512}


def svc(mod, cls):
    return getattr(importlib.import_module('bl_ext.blender_org.mpfb.services.' + mod), cls)


def body(name):
    return bpy.data.objects['human_' + name]


def parts(name):
    """Every mesh that belongs to a character (children of the basemesh), basemesh first."""
    bm = body(name)
    return [bm] + [o for o in bpy.data.objects if o.type == 'MESH' and o.parent == bm]


# ---------------------------------------------------------------- meshes
def bake(ob, with_armature=False, keep=()):
    """Replace the object's mesh with its evaluated mesh (shape keys, masks, subsurf, solidify
    applied); vertex groups survive. All modifiers are removed afterwards except Armature."""
    arms = [m for m in ob.modifiers if m.type == 'ARMATURE']
    for m in arms:
        m.show_viewport = with_armature
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    old = ob.data
    ob.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)
    for m in list(ob.modifiers):
        if m.type != 'ARMATURE' or with_armature:
            ob.modifiers.remove(m)
    for m in ob.modifiers:
        m.show_viewport = True
    return ob


def slim(ob):
    """Game detail level: no subdivision, no knit displacement, single-sided cloth."""
    for m in list(ob.modifiers):
        if m.type in ('SUBSURF', 'DISPLACE', 'SOLIDIFY'):
            ob.modifiers.remove(m)


def make_socks(name):
    """Socks from the basemesh's own feet: the faces below the ankle, pushed out a few millimetres."""
    bm = body(name)
    dg = bpy.context.evaluated_depsgraph_get()
    masks = [(m, m.show_viewport) for m in bm.modifiers if m.type in ('MASK', 'ARMATURE')]
    for m, _ in masks:
        m.show_viewport = False
    dg.update()
    src = bpy.data.meshes.new_from_object(bm.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    for m, v in masks:
        m.show_viewport = v
    b = bmesh.new()
    b.from_mesh(src)
    b.normal_update()
    # Feet only: low, and part of the skin (MPFB's basemesh also carries helper geometry).
    gi = {g.name: g.index for g in bm.vertex_groups}
    body_g = gi.get('body')
    dl = b.verts.layers.deform.active

    def on_body(v):
        return body_g is None or (dl is not None and body_g in v[dl])
    kill = [f for f in b.faces if f.calc_center_median().z > 0.105 or not all(on_body(v) for v in f.verts)]
    bmesh.ops.delete(b, geom=kill, context='FACES')
    bmesh.ops.delete(b, geom=[v for v in b.verts if not v.link_faces], context='VERTS')
    for v in b.verts:
        v.co += v.normal * 0.0035
    me = bpy.data.meshes.new('socks_' + name)
    b.to_mesh(me)
    b.free()
    bpy.data.meshes.remove(src)
    old = bpy.data.objects.get('socks_' + name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    ob = bpy.data.objects.new('socks_' + name, me)
    bm.users_collection[0].objects.link(ob)
    ob.parent = bm
    ob.matrix_parent_inverse = Matrix.Identity(4)
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(plain('socks.' + name, SOCKS[name], rough=1.0))
    return ob


# ---------------------------------------------------------------- weights
def rig(name):
    HS = svc('humanservice', 'HumanService')
    bm = body(name)
    if bm.parent and bm.parent.type == 'ARMATURE':
        return bm.parent
    arm = HS.add_builtin_rig(bm, 'mixamo')
    arm.name = 'rig_game_' + name
    return arm


def copy_weights(src, dst, k=4):
    """Give a garment/asset the weights of the nearest skin: average of the k nearest body vertices."""
    arm = src.parent
    bones = [b.name for b in arm.data.bones if b.use_deform]
    gi = {g.name: g.index for g in src.vertex_groups}
    cols = [gi[b] for b in bones if b in gi]
    names = [b for b in bones if b in gi]
    mw = src.matrix_world
    verts = src.data.vertices
    W = np.zeros((len(verts), len(names)), np.float32)
    col_of = {c: j for j, c in enumerate(cols)}
    kd = kdtree.KDTree(len(verts))
    for v in verts:
        kd.insert(mw @ v.co, v.index)
        for g in v.groups:
            j = col_of.get(g.group)
            if j is not None:
                W[v.index, j] = g.weight
    kd.balance()
    for g in list(dst.vertex_groups):
        if g.name in names:
            dst.vertex_groups.remove(g)
    groups = [dst.vertex_groups.new(name=n) for n in names]
    dw = dst.matrix_world
    for v in dst.data.vertices:
        near = kd.find_n(dw @ v.co, k)
        acc = np.zeros(len(names), np.float32)
        tot = 0.0
        for _, i, d in near:
            w = 1.0 / max(d, 1e-4)
            acc += W[i] * w
            tot += w
        acc /= max(tot, 1e-6)
        top = np.argsort(acc)[-4:]
        s = acc[top].sum()
        for j in top:
            if acc[j] > 0.01 and s > 0:
                groups[j].add([v.index], float(acc[j] / s), 'REPLACE')
    mod = dst.modifiers.get('Armature') or dst.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm


# ---------------------------------------------------------------- the rest pose
def arms_down(arm):
    """Rotate the upper arms (and straighten the forearms) so they hang by the sides, like the game rig."""
    bpy.context.view_layer.update()
    for side in ('Left', 'Right'):
        for bn, nxt in (('Arm', 'ForeArm'), ('ForeArm', 'Hand')):
            pb = arm.pose.bones['mixamorig:' + side + bn]
            nb = arm.pose.bones['mixamorig:' + side + nxt]
            bpy.context.view_layer.update()
            head = arm.matrix_world @ pb.head
            cur = (arm.matrix_world @ nb.head) - head
            s = 1 if head.x > arm.matrix_world.translation.x else -1
            want = Vector((s * 0.1, 0.0, -1.0)).normalized()
            q = cur.normalized().rotation_difference(want)
            R = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head)
            pb.matrix = arm.matrix_world.inverted() @ R @ arm.matrix_world @ pb.matrix
            bpy.context.view_layer.update()


def apply_rest(arm, meshes):
    """Bake the current pose into every mesh, then make it the armature's rest pose."""
    for ob in meshes:
        bake(ob, with_armature=True)
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    for ob in meshes:
        m = ob.modifiers.new('Armature', 'ARMATURE')
        m.object = arm


# ---------------------------------------------------------------- materials
def plain(name, color, rough=0.9):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    return m


def small_copy(img, size, fmt):
    key = f'{img.name}@{size}'
    c = bpy.data.images.get(key)
    if c:
        return c
    c = img.copy()
    c.name = key
    if max(c.size) > size:
        c.scale(size, size)
    c.file_format = fmt
    return c


def images_in(m):
    found = []

    def walk(nt, d=0):
        for n in nt.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                found.append(n.image)
            if n.type == 'GROUP' and n.node_tree and d < 3:
                walk(n.node_tree, d + 1)
    if m and m.use_nodes:
        walk(m.node_tree)
    return found


def game_material(src, kind, uv=None):
    """A plain Principled material carrying src's colour texture: what glTF (and three.js) understand."""
    name = src.name + '.game'
    if bpy.data.materials.get(name):
        return bpy.data.materials[name]
    imgs = [i for i in images_in(src) if i.colorspace_settings.name != 'Non-Color' and 'sss' not in i.name.lower() and 'height' not in i.name.lower()]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    b.inputs['Roughness'].default_value = {'skin': 0.55, 'eye': 0.15, 'hair': 0.55, 'knit': 1.0}.get(kind, 0.8)
    if imgs:
        size = TEX.get(kind, TEX['small'])
        alpha = kind in ('hair', 'small')
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = small_copy(imgs[0], size, 'PNG' if alpha else 'JPEG')
        if uv:
            u = nt.nodes.new('ShaderNodeUVMap')
            u.uv_map = uv
            nt.links.new(u.outputs['UV'], t.inputs['Vector'])
        nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
        if alpha:
            # Alpha clip (glTF MASK): the exporter reads a Math "greater than" in front of Alpha as the cutoff.
            g = nt.nodes.new('ShaderNodeMath')
            g.operation = 'GREATER_THAN'
            g.inputs[1].default_value = 0.45
            nt.links.new(t.outputs['Alpha'], g.inputs[0])
            nt.links.new(g.outputs['Value'], b.inputs['Alpha'])
            try:
                m.blend_method = 'CLIP'
            except (AttributeError, TypeError):
                pass   # newer Blender: the alpha node setup alone decides
    else:
        b.inputs['Base Color'].default_value = base_color(src)
    m.use_backface_culling = kind not in ('knit', 'hair', 'small')
    return m


def base_color(src):
    """The colour of an untextured material: its Principled base colour, else its viewport colour."""
    if src.use_nodes:
        for n in src.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED' and not n.inputs['Base Color'].is_linked:
                return tuple(n.inputs['Base Color'].default_value)
    return tuple(src.diffuse_color)


def kind_of(ob):
    n = ob.name
    if n.startswith('human_') and '.' not in n:
        return 'skin'
    if 'high-poly' in n:
        return 'eye'
    if any(k in n for k in ('ponytail', 'short0', 'fringe', 'strands')):
        return 'hair'
    if any(k in n for k in ('eyebrow', 'eyelash')):
        return 'small'
    if any(k in n for k in ('sweater', 'hood', 'pocket')):
        return 'knit'
    return 'other'


def set_game_materials(ob):
    kind = kind_of(ob)
    uv = 'knit' if kind == 'knit' and 'knit' in ob.data.uv_layers else None
    if uv:
        ob.data.uv_layers.active = ob.data.uv_layers[uv]
    skin = None
    for slot in ob.material_slots:
        if not slot.material or slot.material.name.endswith('.game') or slot.material.name.startswith('socks.'):
            continue
        if kind == 'skin':   # lips, nails, ears... all share the one skin texture
            skin = skin or game_material(slot.material, 'skin')
            slot.material = skin
        else:
            slot.material = game_material(slot.material, kind, uv)


# ---------------------------------------------------------------- the whole job
def prepare(save_copy=True, names=NAMES):
    if save_copy and not bpy.data.filepath.endswith('_game.blend'):
        p = bpy.data.filepath
        bpy.ops.wm.save_as_mainfile(filepath=p[:-6] + '_game.blend')
    report = {}
    for name in names:
        bm = body(name)
        for o in list(parts(name))[1:]:
            if any(d in o.name for d in DROP):
                bpy.data.objects.remove(o, do_unlink=True)
        make_socks(name)
        arm = rig(name)
        for o in parts(name):
            slim(o)
            if o is not bm:
                bake(o)
        bake(bm)             # shape keys and the hide-under-clothes masks, applied
        for o in parts(name)[1:]:
            copy_weights(bm, o)
        arms_down(arm)
        apply_rest(arm, parts(name))
        for o in parts(name):
            set_game_materials(o)
        report[name] = {o.name: len(o.data.polygons) for o in parts(name)}
    return report


def export_all(folder):
    os.makedirs(folder, exist_ok=True)
    out = {}
    for name in NAMES:
        arm = body(name).parent
        for o in bpy.context.selected_objects:
            o.select_set(False)
        arm.select_set(True)
        for o in parts(name):
            o.hide_set(False)
            o.select_set(True)
        bpy.context.view_layer.objects.active = arm
        # Export at the origin: the game places the character itself.
        loc = arm.location.copy()
        arm.location = (0, 0, 0)
        path = os.path.join(folder, name + '.glb')
        kw = dict(filepath=path, use_selection=True, export_format='GLB', export_skins=True, export_animations=False,
                  export_morph=False, export_apply=False, export_yup=True, export_image_format='AUTO',
                  export_def_bones=True, export_materials='EXPORT')
        try:
            bpy.ops.export_scene.gltf(**kw)
        except TypeError:
            kw.pop('export_def_bones')
            bpy.ops.export_scene.gltf(**kw)
        arm.location = loc
        out[name] = os.path.getsize(path)
    return out
