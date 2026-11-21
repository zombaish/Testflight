// Final Approach - gear.js (v0.5.2)
// Landing gear: MODEL ONLY (gear down). Same units as the cockpit: rig-local metres,
// origin = captain's eyes, -z forward. The ground is y = -4 (when flight.y = 0).
// Nose gear sits under the cockpit on the centreline (x 0.5); main gears are further back, left and right.
//
// NAMES: every part is in this.parts, e.g. gear.parts["GEAR_NOSE_WHEEL_LEFT"].
//   GEAR_NOSE_*  GEAR_MAIN_LEFT_*  GEAR_MAIN_RIGHT_*    (LEFT/RIGHT = as seen from the cockpit)
// The nose taxi light can glow: gear.setGlow("GEAR_NOSE_TAXI_LIGHT", 1)
class LandingGear {
  constructor() {
    this.group = new THREE.Group();
    this.parts = {};
    const lam = color => new THREE.MeshLambertMaterial({ color });
    this.m = {
      strut: lam(0xb8bcc4), piston: lam(0xdfe2e6), tyre: lam(0x18191c), hub: lam(0x9aa0a8),
      door: lam(0x8b929b), brake: lam(0x5a4a40), link: lam(0x2c2f35),
      lamp: new THREE.MeshBasicMaterial({ color: 0x6a6a60 }),
    };
    this.glow = [];
    this.buildNose();
    this.buildMain("LEFT", -1);
    this.buildMain("RIGHT", 1);
    this.setupGlow();
  }

  tag(obj, name) {
    if (this.parts[name]) console.warn("Gear: duplicate part name " + name);
    obj.name = name;
    this.parts[name] = obj;
    return obj;
  }
  box(w, h, d, mat, x, y, z, name) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    this.group.add(m);
    return this.tag(m, name);
  }
  rod(p0, p1, r, mat, name) { // cylinder between two points
    const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1);
    const dir = b.clone().sub(a), len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    this.group.add(m);
    return this.tag(m, name);
  }
  wheel(r, w, mat, x, y, z, name) { // cylinder with its axis along x
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 24), mat);
    m.rotation.z = Math.PI / 2;
    m.position.set(x, y, z);
    this.group.add(m);
    return this.tag(m, name);
  }

  // Nose gear: two small wheels, strut, torque link, drag brace, two doors, taxi light
  buildNose() {
    const { strut, piston, tyre, hub, door, link, lamp } = this.m;
    const X = 0.5, Z = 1.6, BELLY = -2.0, AXLE = -3.67; // wheel radius 0.33 -> tyre bottom at -4.0
    this.rod([X, BELLY, Z], [X, -3.0, Z], 0.07, strut, "GEAR_NOSE_STRUT_UPPER");
    this.rod([X, -3.0, Z], [X, AXLE, Z], 0.045, piston, "GEAR_NOSE_STRUT_LOWER");
    this.rod([X - 0.26, AXLE, Z], [X + 0.26, AXLE, Z], 0.03, link, "GEAR_NOSE_AXLE");
    [["LEFT", -1], ["RIGHT", 1]].forEach(([s, d]) => {
      this.wheel(0.33, 0.2, tyre, X + d * 0.13, AXLE, Z, "GEAR_NOSE_WHEEL_" + s);
      this.wheel(0.16, 0.22, hub, X + d * 0.13, AXLE, Z, "GEAR_NOSE_HUB_" + s);
      this.box(0.03, 0.7, 1.1, door, X + d * 0.3, -2.35, Z, "GEAR_NOSE_DOOR_" + s);
    });
    this.rod([X, -3.05, Z + 0.04], [X, -3.4, Z + 0.22], 0.015, link, "GEAR_NOSE_TORQUE_LINK");
    this.rod([X, -2.7, Z], [X, BELLY, Z - 0.9], 0.04, strut, "GEAR_NOSE_DRAG_BRACE");
    this.box(0.12, 0.06, 0.04, lamp.clone(), X, -3.05, Z - 0.09, "GEAR_NOSE_TAXI_LIGHT");
  }

  // Main gear (side -1 = left, +1 = right): two big wheels on an axle, brake, braces, door
  buildMain(S, d) {
    const { strut, piston, tyre, hub, door, brake, link } = this.m;
    const X = 0.5 + d * 2.6, Z = 11.5, BELLY = -2.0, AXLE = -3.45; // wheel radius 0.55 -> bottom at -4.0
    const n = "GEAR_MAIN_" + S + "_";
    this.rod([X, BELLY, Z], [X, -2.9, Z], 0.09, strut, n + "STRUT_UPPER");
    this.rod([X, -2.9, Z], [X, AXLE, Z], 0.06, piston, n + "STRUT_LOWER");
    this.rod([X - 0.55, AXLE, Z], [X + 0.55, AXLE, Z], 0.05, link, n + "AXLE");
    [["INNER", -d], ["OUTER", d]].forEach(([w, side]) => {
      this.wheel(0.55, 0.3, tyre, X + side * 0.42, AXLE, Z, n + "WHEEL_" + w);
      this.wheel(0.3, 0.32, hub, X + side * 0.42, AXLE, Z, n + "HUB_" + w);
    });
    this.box(0.5, 0.28, 0.28, brake, X, AXLE, Z, n + "BRAKE_ASSEMBLY");
    this.rod([X, -2.7, Z], [X - d * 0.9, BELLY, Z], 0.04, strut, n + "SIDE_BRACE");
    this.rod([X, -2.9, Z], [X, BELLY, Z - 1.0], 0.045, strut, n + "DRAG_BRACE");
    this.box(0.04, 0.9, 1.8, door, X - d * 0.55, -2.45, Z, n + "DOOR");
  }

  // Lights that can glow (just the taxi light for now)
  setupGlow() {
    for (const name of Object.keys(this.parts)) {
      const p = this.parts[name];
      if (p.material && p.material.isMeshBasicMaterial) {
        p.userData.glow = { off: p.material.color.clone(), on: new THREE.Color(0xfff0cc) };
        this.glow.push(p);
      }
    }
  }
  setGlow(name, a) { // 0 = dim .. 1 = fully lit
    const p = this.parts[name], g = p && p.userData.glow;
    if (g) p.material.color.copy(g.off).lerp(g.on, a);
  }
  setGlowAll(a) {
    for (const p of this.glow) p.material.color.copy(p.userData.glow.off).lerp(p.userData.glow.on, a);
  }
}
