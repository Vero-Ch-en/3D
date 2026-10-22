"""Knee-length wool coats for the realistic characters, built round each body (run in Blender after
game_export.prepare/optimise, in cozy_characters_game.blend). make_coat(name) adds coat_<name>; skin_coat
weights it to the rig (upper coat like the body, the skirt from the hips onto its own thigh and a spring bone)."""
import bpy, math
from mathutils import Vector
from game_export import rig, parts, full_body, copy_weights

def coat_body(name, color=(0.36, 0.37, 0.39), knee_drop=0.06, ease=0.014, flare=0.11, nseg=40):
    """A knee-length wool coat built round this character's own body: two halves (left, right) that meet
    down the front and back, closed above the waist, open below it so each side can follow its leg.
    Upper coat weighted like the body; the skirt blends from the hips onto its own thigh and a spring bone."""
    import bmesh, math
    from mathutils import Vector
    arm = rig(name); W = arm.matrix_world; B = arm.data.bones
    P = lambda b: W @ B['mixamorig:' + b].head_local
    hips, spine, neck = P('Hips'), P('Spine'), P('Neck')
    zNeck = neck.z - 0.015; zKnee = P('LeftLeg').z - knee_drop; zCrotch = P('LeftUpLeg').z - 0.06; zWaist = spine.z + 0.02
    cx, cy = hips.x, (hips.y + spine.y) / 2
    for o in list(bpy.data.objects):
        if o.name.startswith('coat_' + name):
            bpy.data.objects.remove(o, do_unlink=True)
    # Sample the body: skin, jumper, leggings (not arms: they get sleeves).
    pts = []
    for p in parts(name):
        n = p.name.lower()
        if not any(s in n for s in ('human_' + name, 'sweater', 'leggings', 'cord')) or any(s in n for s in ('eye', 'brow', 'lash', 'hair', 'poly', 'tail', 'fringe', 'short')):
            continue
        gi = {g.index: g.name for g in p.vertex_groups}
        mw = p.matrix_world
        for v in p.data.vertices:
            best = max(v.groups, key=lambda g: g.weight, default=None)
            if best and any(s in gi.get(best.group, '') for s in ('Arm', 'Hand')) and best.weight > 0.45:
                continue
            q = mw @ v.co
            if zKnee - 0.05 < q.z < zNeck + 0.03:
                pts.append(q)
    # Rings: radius per angle = furthest body point in that slice and direction, eased and smoothed.
    nr = 30
    zs = [zNeck - (zNeck - zKnee) * (i / (nr - 1)) for i in range(nr)]
    R = []
    for zi, z in enumerate(zs):
        dz = (zs[0] - zs[-1]) / (nr - 1) * 0.8 + 0.01
        rad = [0.0] * nseg
        for q in pts:
            if abs(q.z - z) > dz:
                continue
            a = math.atan2(q.x - cx, -(q.y - cy))   # 0 = front (-y), + toward the character's left (+x)
            b = int(((a / (2 * math.pi)) % 1) * nseg) % nseg
            r = math.hypot(q.x - cx, q.y - cy)
            if r > rad[b]:
                rad[b] = r
        R.append(rad)
    # fill empty bins, enclose (the skirt goes round both legs), smooth round and down
    for zi in range(nr):
        rad = R[zi]
        for b in range(nseg):
            if rad[b] == 0:
                rad[b] = max(rad[(b - 1) % nseg], rad[(b + 1) % nseg], 0.06)
    for it in range(3):
        for zi in range(nr):
            rad = R[zi]; R[zi] = [max(rad[b], (rad[(b - 1) % nseg] + rad[(b + 1) % nseg]) / 2) for b in range(nseg)]
    for zi in range(nr):
        z = zs[zi]
        below = max(0.0, (zCrotch - z) / max(0.01, zCrotch - zKnee))
        R[zi] = [r + ease + flare * below ** 1.2 * (0.6 + 0.4 * abs(math.cos(b / nseg * 2 * math.pi))) for b, r in enumerate(R[zi])]
    # monotone below the waist: a coat hangs, it doesn't follow the backs of the knees
    for zi in range(1, nr):
        if zs[zi] < zWaist - 0.05:
            R[zi] = [max(R[zi][b], R[zi - 1][b] * 0.995) for b in range(nseg)]
    for it in range(2):
        R = [R[0]] + [[(R[zi - 1][b] + 2 * R[zi][b] + R[zi + 1][b]) / 4 for b in range(nseg)] for zi in range(1, nr - 1)] + [R[-1]]
    me = bpy.data.meshes.new('coat_' + name); ob = bpy.data.objects.new('coat_' + name, me)
    for c in arm.users_collection:
        c.objects.link(ob)
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new()
    # Two halves: right (angles -pi..0) and left (0..pi); each half shares its seam positions with the other.
    halves = {}
    for side, (a0, a1) in (('R', (-math.pi, 0.0)), ('L', (0.0, math.pi))):
        n = nseg // 2
        rows = []
        for zi, z in enumerate(zs):
            row = []
            for j in range(n + 1):
                a = a0 + (a1 - a0) * j / n
                b = (a / (2 * math.pi)) % 1 * nseg
                b0 = int(b) % nseg; t = b - int(b); r = R[zi][b0] * (1 - t) + R[zi][(b0 + 1) % nseg] * t
                # the left front laps over the right a little, as a coat does
                if side == 'L' and j == 0: r += 0.004
                row.append(bm.verts.new((cx + math.sin(a) * r, cy - math.cos(a) * r, z)))
            rows.append(row)
        for zi in range(nr - 1):
            for j in range(n):
                f = bm.faces.new((rows[zi][j], rows[zi + 1][j], rows[zi + 1][j + 1], rows[zi][j + 1]))
                for l, (u, v) in zip(f.loops, ((j / n, zi), (j / n, zi + 1), ((j + 1) / n, zi + 1), ((j + 1) / n, zi))):
                    l[uvl].uv = ((u * 0.5 + (0.5 if side == 'L' else 0)) * 3, -v / (nr - 1) * 3)
        halves[side] = rows
    bm.normal_update(); bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    # Material: wool, both sides visible (the inside shows at the hem and the opening).
    mat = bpy.data.materials.get('coat_' + name) or bpy.data.materials.new('coat_' + name)
    mat.use_nodes = True; bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1); bsdf.inputs['Roughness'].default_value = 0.92
    mat.use_backface_culling = False
    me.materials.clear(); me.materials.append(mat)
    # Normals out: faces were wound for the right half; flip the left if needed by checking one face.
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    return ob, {'zs': [zs[0], zs[-1]], 'zCrotch': zCrotch, 'zWaist': zWaist, 'pts': len(pts), 'cx': cx, 'cy': cy}


def make_coat(name, color=(0.36, 0.37, 0.39), **kw):
    import bmesh, math
    from mathutils import Vector
    ob, info = coat_body(name, color=color, **kw)
    arm = rig(name); W = arm.matrix_world; B = arm.data.bones
    P = lambda b: W @ B['mixamorig:' + b].head_local
    cx, cy = info['cx'], info['cy']
    neck = P('Neck'); zNeck = info['zs'][0]
    zSh = (P('LeftArm').z + P('RightArm').z) / 2
    shHalf = (abs(P('LeftArm').x - cx) + abs(P('RightArm').x - cx)) / 2 + 0.03
    rNeck = 0.062 * (zNeck - P('Hips').z) / 0.54
    # Shoulders: above the shoulder joints the coat narrows to the neck (a slope, not a shelf).
    me = ob.data
    for v in me.vertices:
        z = v.co.z
        if z > zSh - 0.03:
            t = min(1, max(0, (z - (zSh - 0.03)) / (zNeck - (zSh - 0.03))))
            dx, dy = v.co.x - cx, v.co.y - cy
            r = math.hypot(dx, dy) or 1e-6
            side = abs(dx) / r                     # 1 at the shoulder points, 0 front and back
            cap = rNeck + (1 - t) ** 0.8 * ((shHalf - rNeck) * side + (r - rNeck) * (1 - side) * 0.9)
            capd = rNeck * 1.15 + (1 - t) * (r - rNeck * 1.15)
            lim = min(r, cap if side > 0.5 else max(cap, capd))
            v.co.x = cx + dx / r * lim; v.co.y = cy + dy / r * lim
    # Sleeves: a tube along each arm, sized from the jumper sleeve round it, from the shoulder to the wrist.
    # sleeve sizes from the arm part of the jumper (and arm skin) only, not its body
    spts = []
    for s in [o for o in parts(name) if 'sweater' in o.name or o.name == 'human_' + name]:
        gi = {g.index: g.name for g in s.vertex_groups}
        for v in s.data.vertices:
            best = max(v.groups, key=lambda g: g.weight, default=None)
            if best and any(k in gi.get(best.group, '') for k in ('Arm', 'Hand')) and best.weight > 0.5:
                spts.append(s.matrix_world @ v.co)
    bm = bmesh.new(); bm.from_mesh(me); uvl = bm.loops.layers.uv.verify()
    ob['body_verts'] = len(bm.verts)
    for S in ('Left', 'Right'):
        a0, a1, a2 = P(S + 'Arm'), P(S + 'ForeArm'), P(S + 'Hand')
        out = (a0 - Vector((cx, cy, a0.z))).normalized()
        chain = [(a0 - out * 0.035 + Vector((0, 0, 0.02)), a0), (a0, a1), (a1, a2)]
        rings = []
        nseg, ns = 16, 7
        pts_axis = []
        for (p, q) in chain[1:]:
            for i in range(ns):
                pts_axis.append(p + (q - p) * (i / ns))
        pts_axis.append(a2 - (a2 - a1).normalized() * 0.02)
        pts_axis.insert(0, chain[0][0])
        for k, c in enumerate(pts_axis):
            d = (pts_axis[min(k + 1, len(pts_axis) - 1)] - pts_axis[max(k - 1, 0)]).normalized()
            u = d.cross(Vector((0, 1, 0))).normalized(); w = d.cross(u).normalized()
            rad = 0.03
            for q in spts:
                rel = q - c
                if abs(rel.dot(d)) < 0.025:
                    rr = (rel - d * rel.dot(d)).length
                    if rr < 0.075 and rr > rad: rad = rr
            rad += 0.012 + (0.008 if k > len(pts_axis) - 4 else 0)   # a little wider at the cuff
            ring = [bm.verts.new(c + (u * math.cos(j / nseg * 2 * math.pi) + w * math.sin(j / nseg * 2 * math.pi)) * rad) for j in range(nseg)]
            rings.append(ring)
        for k in range(len(rings) - 1):
            for j in range(nseg):
                f = bm.faces.new((rings[k][j], rings[k][(j + 1) % nseg], rings[k + 1][(j + 1) % nseg], rings[k + 1][j]))
                for l, (uu, vv) in zip(f.loops, ((j, k), (j + 1, k), (j + 1, k + 1), (j, k + 1))):
                    l[uvl].uv = (uu / nseg * 1.5, -vv / len(rings) * 2.5)
    bm.verts.ensure_lookup_table(); ob['sleeve_verts'] = len(bm.verts) - ob['body_verts']
    # Collar: a band standing round the neck from the coat's top edge, opening at the front.
    top = [v for v in bm.verts if abs(v.co.z - zNeck) < 1e-4]
    top.sort(key=lambda v: math.atan2(v.co.x - cx, -(v.co.y - cy)))
    col = []
    for v in top:
        d = Vector((v.co.x - cx, v.co.y - cy, 0)); r = d.length or 1e-6
        col.append(bm.verts.new((cx + d.x / r * (r + 0.012), cy + d.y / r * (r + 0.012), zNeck + 0.045)))
    for i in range(len(top) - 1):
        a = math.atan2(top[i].co.x - cx, -(top[i].co.y - cy))
        if abs(a) < 0.25:   # open at the front
            continue
        try:
            bm.faces.new((top[i], top[i + 1], col[i + 1], col[i]))
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    info['shHalf'] = shHalf; info['verts'] = len(me.vertices)
    return ob, info


def skin_coat(name, spring=0.35, thigh=0.45):
    """Weight coat_<name> to its rig. Upper coat and sleeves: the body's own weights (nearest skin).
    The skirt, from just below the crotch to the hem, blends from those onto its own thigh and a spring
    bone (coat_L / coat_R, children of the hips) that the game swings, so the tails trail and settle."""
    ob = bpy.data.objects['coat_' + name]
    arm = rig(name); W = arm.matrix_world; B = arm.data.bones
    P = lambda b: W @ B['mixamorig:' + b].head_local
    hips = P('Hips'); zTop = P('LeftUpLeg').z - 0.02; zKnee = P('LeftLeg').z - 0.06
    # Spring bones for the two coat tails.
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = arm; arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones; Wi = W.inverted()
    for S, sx in (('L', 1), ('R', -1)):
        nm = 'coat_' + S
        if nm in eb:
            eb.remove(eb[nm])
        b = eb.new(nm)
        side = P(('Left' if S == 'L' else 'Right') + 'UpLeg')
        b.head = Wi @ Vector((side.x, side.y, zTop + 0.04)); b.tail = Wi @ Vector((side.x, side.y, zKnee))
        b.parent = eb['mixamorig:Hips']; b.use_deform = True; b.roll = 0
    bpy.ops.object.mode_set(mode='OBJECT')
    # Body weights first.
    tmp = full_body(name)
    copy_weights(tmp, ob)
    bpy.data.objects.remove(tmp, do_unlink=True)
    cx = hips.x
    vg = {g.name: g for g in ob.vertex_groups}
    for nm in ('coat_L', 'coat_R', 'mixamorig:LeftUpLeg', 'mixamorig:RightUpLeg', 'mixamorig:Hips'):
        if nm not in vg:
            vg[nm] = ob.vertex_groups.new(name=nm)
    mw = ob.matrix_world
    for v in ob.data.vertices:
        p = mw @ v.co
        if p.z >= zTop:
            continue
        t = min(1.0, (zTop - p.z) / max(0.05, zTop - zKnee)); t = t * t * (3 - 2 * t)
        S = 'L' if p.x > cx else 'R'
        old = [(ob.vertex_groups[g.group].name, g.weight) for g in v.groups]
        for g in list(v.groups):
            ob.vertex_groups[g.group].remove([v.index])
        # the skirt hangs from the hips: whatever leg weight the nearest skin gave becomes this side's thigh
        acc = {}
        for gname, w in old:
            if 'Leg' in gname or 'Foot' in gname or 'Toe' in gname:
                gname = 'mixamorig:' + ('Left' if S == 'L' else 'Right') + 'UpLeg'
            acc[gname] = acc.get(gname, 0) + w * (1 - t)
        mix = {'mixamorig:Hips': 1 - thigh - spring, 'mixamorig:' + ('Left' if S == 'L' else 'Right') + 'UpLeg': thigh, 'coat_' + S: spring}
        for gname, w in mix.items():
            acc[gname] = acc.get(gname, 0) + w * t
        tot = sum(acc.values()) or 1
        for gname, w in acc.items():
            if w / tot > 0.002:
                vg.setdefault(gname, ob.vertex_groups.get(gname) or ob.vertex_groups.new(name=gname)).add([v.index], w / tot, 'REPLACE')
    # The coat's body and collar hang from the torso and legs, never the arms: nearest skin at hip height
    # is the hanging hands, and their weights would drag the coat about whenever the arms moved.
    nb = ob.get('body_verts', 0); nsl = ob.get('sleeve_verts', 0)
    for v in ob.data.vertices:
        if nb <= v.index < nb + nsl:
            continue
        gs = [(ob.vertex_groups[g.group].name, g.weight, g.group) for g in v.groups]
        bad = [g for g in gs if any(k in g[0] for k in ('Arm', 'Hand', 'Shoulder'))]
        if not bad:
            continue
        keep = [g for g in gs if g not in bad]
        if not keep:
            keep = [('mixamorig:Spine2', 1.0, None)]
        for name_, w, gi in bad:
            ob.vertex_groups[gi].remove([v.index])
        tot = sum(w for _, w, _ in keep) or 1
        for name_, w, gi in keep:
            (ob.vertex_groups.get(name_) or ob.vertex_groups.new(name=name_)).add([v.index], w / tot, 'REPLACE')
    # Parent to the rig like the other clothes (under the body, so parts(name) includes it).
    mwc = ob.matrix_world.copy()
    ob.parent = bpy.data.objects['human_' + name]; ob.matrix_world = mwc
    for m in [m for m in ob.modifiers if m.type == 'ARMATURE']:
        ob.modifiers.remove(m)
    md = ob.modifiers.new('Armature', 'ARMATURE'); md.object = arm
    return {'groups': len(ob.vertex_groups), 'zTop': zTop, 'zKnee': zKnee}


def fit_coat(name, ease_body=0.016, ease_arm=0.012, iters=6):
    """Tailor coat_<name> to the body under it (run after make_coat + skin_coat; same vertices, so the weights
    still hold). Sleeves and the upper coat are drawn in to sit `ease` off the jumper/skin, relaxed like cloth;
    the skirt keeps its flare (blended through the hips); the front seam is welded above the skirt opening.
    Keeps a hidden, unparented copy as backup_coat_<name> (never exported). Used for build 54's fitted coats."""
    from mathutils.bvhtree import BVHTree
    from mathutils import kdtree
    coat = bpy.data.objects['coat_' + name]; arm = rig(name); W = arm.matrix_world; B = arm.data.bones
    P = lambda b: W @ B['mixamorig:' + b].head_local
    hips = P('Hips'); zHip = hips.z; zTop = P('LeftUpLeg').z - 0.02; neck = P('Neck'); cx = hips.x
    if 'backup_coat_' + name not in bpy.data.objects:
        b = coat.copy(); b.data = coat.data.copy(); b.name = 'backup_coat_' + name
        bpy.context.scene.collection.objects.link(b); b.parent = None; b.hide_set(True); b.hide_render = True
    src = [bpy.data.objects[x] for x in ('sweater_' + name, 'human_' + name, 'cord_' + name + '_1') if x in bpy.data.objects]
    verts, polys = [], []
    for o in src:
        mw = o.matrix_world; off = len(verts)
        verts += [mw @ v.co for v in o.data.vertices]; polys += [[off + i for i in p.vertices] for p in o.data.polygons]
    tree = BVHTree.FromPolygons(verts, polys)
    me = coat.data; mw = coat.matrix_world; iw = mw.inverted()
    nb = coat.get('body_verts', 0); nsl = coat.get('sleeve_verts', 0)
    orig = [v.co.copy() for v in me.vertices]; pos = [mw @ c for c in orig]
    sleeve = lambda i: nb <= i < nb + nsl
    def wfit(i, p):
        if sleeve(i) or p.z >= zHip + 0.06: return 1.0
        if p.z <= zTop - 0.04: return 0.0
        return (p.z - (zTop - 0.04)) / ((zHip + 0.06) - (zTop - 0.04))
    w8 = [wfit(i, p) for i, p in enumerate(pos)]
    nbrs = [[] for _ in pos]
    for e in me.edges:
        a, b = e.vertices; nbrs[a].append(b); nbrs[b].append(a)
    def project():
        for i, p in enumerate(pos):
            if w8[i] <= 0: continue
            loc, nor, _, _ = tree.find_nearest(p)
            if loc is None: continue
            ease = ease_arm if sleeve(i) else ease_body
            s = (p - loc).length * (1 if (p - loc).dot(nor) >= 0 else -1)
            if s > ease or s < ease * 0.6: pos[i] = p.lerp(loc + nor * ease, w8[i])
    for _ in range(iters):
        project()
        new = [p.copy() for p in pos]
        for i, p in enumerate(pos):
            if w8[i] > 0 and nbrs[i]:
                new[i] = p.lerp(sum((pos[j] for j in nbrs[i]), Vector()) / len(nbrs[i]), 0.5 * w8[i])
        pos[:] = new
    project()
    for i, v in enumerate(me.vertices):
        v.co = iw @ pos[i] if w8[i] > 0 else orig[i]
    kd = kdtree.KDTree(len(orig))
    for i, co in enumerate(orig): kd.insert(co, i)
    kd.balance(); done = set()
    for i, co in enumerate(orig):
        if i in done or (mw @ co).z <= zTop: continue
        grp = [j for (_, j, _) in kd.find_range(co, 0.0015)]
        if len(grp) > 1:
            avg = sum((me.vertices[j].co for j in grp), Vector()) / len(grp)
            for j in grp: me.vertices[j].co = avg.copy(); done.add(j)
    import bmesh
    bm = bmesh.new(); bm.from_mesh(me)
    for v in bm.verts:
        p = mw @ v.co
        if v.is_boundary and zTop + 0.01 < p.z < neck.z - 0.02 and abs(p.x - cx) < 0.08 and p.y < hips.y:
            p.x = cx + (0.004 if p.x > cx else -0.004); v.co = iw @ p
    bm.to_mesh(me); bm.free(); me.update()
    return True
