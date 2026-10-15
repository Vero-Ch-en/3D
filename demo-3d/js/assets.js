'use strict';
/* =========================================================================
 * Assets: the bridge to a more realistic version.
 *
 * Everything in the game is built procedurally so it runs with no downloads.
 * List a real asset here and it replaces the procedural one, with no other code
 * changes: props drop into the same spot, texture sets replace the painted
 * textures on a material, and character models are driven by the same rig.
 * See REALISM.md for the conventions (units, pivots, bone names).
 *
 *   props:      { id: { url, scale? } }                 a glTF/GLB placed at the prop's slot
 *   textures:   { material: { map, normalMap, roughnessMap, aoMap, repeat?: [u, v], params? } }
 *   characters: { player | partner: { url, fit?: true, keepMaterials?: true, hideProcedural?: 'all' } }
 * ========================================================================= */
G.ASSET_MANIFEST = Object.assign({ props: {}, textures: {}, characters: {} }, window.CBS_ASSETS || {
  props: {
    // kettle: { url: 'models/props/kettle.glb' },
  },
  textures: {
    // floor: { map: 'textures/oak_albedo.jpg', normalMap: 'textures/oak_normal.jpg', roughnessMap: 'textures/oak_rough.jpg', repeat: [2, 2] },
  },
  characters: {
    // partner: { url: 'models/partner_realistic.glb', fit: true, keepMaterials: true, hideProcedural: 'all' },
  },
});
G.ASSETS = { props: {}, textures: {} };

G.loadAssets = async () => {
  const M = G.ASSET_MANIFEST, jobs = [];
  for (const [id, spec] of Object.entries(M.props)) {
    jobs.push(new Promise((res) => {
      if (!THREE.GLTFLoader) return res();
      new THREE.GLTFLoader().load(spec.url, (g) => { G.ASSETS.props[id] = { scene: g.scene, spec }; res(); }, undefined, (e) => { console.warn('[assets] prop', id, e); res(); });
    }));
  }
  const tl = new THREE.TextureLoader();
  for (const [id, spec] of Object.entries(M.textures)) {
    const set = { maps: {}, params: spec.params || {} };
    for (const key of ['map', 'normalMap', 'roughnessMap', 'aoMap', 'bumpMap', 'metalnessMap']) {
      if (!spec[key]) continue;
      jobs.push(new Promise((res) => tl.load(spec[key], (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping; if (spec.repeat) t.repeat.set(spec.repeat[0], spec.repeat[1]);
        if (key === 'map') t.encoding = THREE.sRGBEncoding;
        t.anisotropy = G.renderer.capabilities.getMaxAnisotropy();
        set.maps[key] = t; res();
      }, undefined, () => { console.warn('[assets] texture', id, key); res(); })));
    }
    G.ASSETS.textures[id] = set;
  }
  await Promise.all(jobs);
};

/* Replace painted textures on the named materials (G.MAT.floor, G.MAT.logs, ...). */
G.applyTextureSets = () => {
  for (const [id, set] of Object.entries(G.ASSETS.textures)) {
    const m = G.MAT[id];
    if (!m || !Object.keys(set.maps).length) continue;
    if (set.maps.bumpMap === undefined && set.maps.normalMap) m.bumpMap = null;   // a real normal map replaces the painted bump
    Object.assign(m, set.maps, set.params);
    if (set.maps.map) m.color.set('#ffffff');
    m.needsUpdate = true;
  }
};

/* A prop slot: a named, placed group. With a model listed for `id` it holds that model (authored in
 * metres, origin on the floor at the footprint's centre, facing +z); otherwise `build(group)` fills it
 * procedurally. Colliders and interaction points stay where the procedural version put them. */
G.propSlot = (id, x, y, z, ry, build, parent) => {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; g.name = 'prop:' + id;
  (parent || G.world).add(g);
  const A = G.ASSETS.props[id];
  if (A) {
    const s = A.scene.clone(true); s.scale.setScalar(A.spec.scale || 1);
    s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(s); g.userData.asset = true;
  } else build(g);
  return g;
};

/* Same idea for a prop already built procedurally into its own group: swap the contents if a model is listed. */
G.propify = (id, g) => {
  const A = G.ASSETS.props[id];
  g.name = 'prop:' + id;
  if (!A) return g;
  for (const c of g.children.slice()) if (!c.isLight) g.remove(c);
  const s = A.scene.clone(true); s.scale.setScalar(A.spec.scale || 1);
  s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.add(s); g.userData.asset = true;
  return g;
};

/* Bone names from common rigs (Mixamo, Rigify/MPFB, Unreal/Blender game rigs) mapped to the game's rig.
 * Sides are matched by where the bone actually sits, not by its name, so mirrored conventions still work. */
const BONE_PARTS = [
  ['hips', /^(hips|pelvis|root_?hips)$/],
  ['spine', /^(spine|spine0?1|spine05|abdomen)$/],
  ['chest', /^(spine0?2|chest|spine03|upperchest|spine2)$/],
  ['neck', /^(neck|neck0?1)$/],
  ['head', /^head$/],
  ['sh', /^(arm|upperarm|upperarm0?1|uparm)$/],
  ['el', /^(forearm|lowerarm|lowerarm0?1|loarm)$/],
  ['hand', /^(hand|wrist)$/],
  ['th', /^(upleg|thigh|upperleg|upperleg0?1|thigh_?l?)$/],
  ['kn', /^(leg|shin|calf|lowerleg|lowerleg0?1)$/],
  ['ft', /^(foot|ankle)$/],
];
G.boneAlias = (name) => {
  let n = name.toLowerCase().replace(/^mixamorig[:_]?/, '').replace(/^(def|org|mch)[-_.]/, '');
  let side = 0;
  if (/^left|[._ ]l$|_l_|\.l\./.test(n)) side = 1; else if (/^right|[._ ]r$|_r_|\.r\./.test(n)) side = -1;
  n = n.replace(/^(left|right)/, '').replace(/([._ ])(l|r)$/, '').replace(/[^a-z0-9]/g, '');
  for (const [part, re] of BONE_PARTS) if (re.test(n)) return { part, side };
  return null;
};
