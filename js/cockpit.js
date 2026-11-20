// Final Approach - cockpit.js (v0.4.4)
// Cockpit rebuild: MODEL ONLY, no function yet. Built in metres.
// Origin = captain's eyes, -z forward, +x right, +y up. Aircraft centreline is x = 0.5.
// Build order: 1 shell (done) > 2 glareshield (done) > 3 main panel + screens (done) > 4 yokes
//              > 5 centre pedestal > 6 overhead panel > 7 seats, side consoles, details
class Cockpit {
  constructor() {
    this.group = new THREE.Group();
    this.m = {
      wall: this.mat(0x6f7782),
      ceil: this.mat(0x8b929b),
      floor: this.mat(0x2a2d32),
      trim: this.mat(0x2e3238),
      glare: this.mat(0x1f2227),
      mcp: this.mat(0x30343b),
      dispBg: new THREE.MeshBasicMaterial({ color: 0x050505 }),
      dispOn: new THREE.MeshBasicMaterial({ color: 0xc87810 }),
      knob: this.mat(0x9aa0a8),
      btn: this.mat(0x5a606a),
      fire: new THREE.MeshBasicMaterial({ color: 0x7a1a1a }),
      caution: new THREE.MeshBasicMaterial({ color: 0x7a5410 }),
      panel: this.mat(0x2a2d33),
      bezel: this.mat(0x101214),
      center: this.mat(0x3a3e45),
      screen: new THREE.MeshBasicMaterial({ color: 0x07090c }),
      gearOn: new THREE.MeshBasicMaterial({ color: 0x1f7a2a }),
    };
    this.buildShell();
    this.buildGlareshield();
    this.buildMainPanel();
  }

  // Mostly emissive with a little diffuse shading, so the outdoor hemisphere light
  // (green from the ground colour) doesn't tint the interior
  mat(color) {
    return new THREE.MeshLambertMaterial({
      color: new THREE.Color(color).multiplyScalar(0.35),
      emissive: color,
      emissiveIntensity: 0.65,
    });
  }

  // Box added to any parent, centred at x,y,z
  box(parent, w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // Box from min/max corners (easier to line pieces up than centre + size)
  slab(x0, x1, y0, y1, z0, z1, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.group.add(m);
    return m;
  }

  // ---- PIECE 1: shell (floor, ceiling, walls, window openings + frames) ----
  buildShell() {
    const { wall, ceil, floor, trim } = this.m;
    const L = -0.55, R = 1.55;              // inner side walls
    const FLOOR = -1.15, CEIL = 0.65;       // floor and ceiling heights
    const FRONT = -0.9, BACK = 1.2;         // inner front and back walls
    const T = 0.1;                          // wall thickness
    const WY0 = -0.05, WY1 = 0.45;          // window sill and top
    const S0 = -0.8, S1 = -0.1;             // side window start/end (z)
    const F = FRONT - T, B = BACK + T;
    const s = (...a) => this.slab(...a);

    // Floor, ceiling, back wall
    s(L - T, R + T, FLOOR - T, FLOOR, F, B, floor);
    s(L - T, R + T, CEIL, CEIL + T, F, B, ceil);
    s(L - T, R + T, FLOOR, CEIL, BACK, B, wall);

    // Front wall with two windshield openings: left x -0.40..0.45, right x 0.55..1.40
    s(L - T, R + T, FLOOR, WY0, F, FRONT, wall);   // below windows
    s(L - T, R + T, WY1, CEIL, F, FRONT, wall);    // above windows
    s(L - T, -0.40, WY0, WY1, F, FRONT, wall);     // left corner pillar
    s(0.45, 0.55, WY0, WY1, F, FRONT, wall);       // centre post
    s(1.40, R + T, WY0, WY1, F, FRONT, wall);      // right corner pillar

    // Side walls with one window each
    const side = (x0, x1) => {
      s(x0, x1, FLOOR, WY0, F, BACK, wall);
      s(x0, x1, WY1, CEIL, F, BACK, wall);
      s(x0, x1, WY0, WY1, F, S0, wall);            // fore pillar
      s(x0, x1, WY0, WY1, S1, BACK, wall);         // aft panel
    };
    side(L - T, L);
    side(R, R + T);

    // Window frames (thin strips on the inside face, 3 cm wide)
    const w = 0.03, d = 0.02;
    const frontFrame = (x0, x1) => {
      s(x0 - w, x0, WY0 - w, WY1 + w, FRONT, FRONT + d, trim);
      s(x1, x1 + w, WY0 - w, WY1 + w, FRONT, FRONT + d, trim);
      s(x0 - w, x1 + w, WY0 - w, WY0, FRONT, FRONT + d, trim);
      s(x0 - w, x1 + w, WY1, WY1 + w, FRONT, FRONT + d, trim);
    };
    frontFrame(-0.40, 0.45);
    frontFrame(0.55, 1.40);
    const sideFrame = (xa, xb) => {
      s(xa, xb, WY0 - w, WY1 + w, S0 - w, S0, trim);
      s(xa, xb, WY0 - w, WY1 + w, S1, S1 + w, trim);
      s(xa, xb, WY0 - w, WY0, S0 - w, S1 + w, trim);
      s(xa, xb, WY1, WY1 + w, S0 - w, S1 + w, trim);
    };
    sideFrame(L, L + d);
    sideFrame(R - d, R);
  }

  // ---- PIECE 2: glareshield (body, autopilot panel, warning lights) ----
  buildGlareshield() {
    const { glare, mcp, dispBg, dispOn, knob, btn, fire, caution } = this.m;
    const CX = 0.5; // aircraft centreline

    // Body: full width, top at y -0.07 (just under the window sills), 0.4 m deep
    this.slab(-0.55, 1.55, -0.2, -0.07, -0.9, -0.5, glare);

    // Autopilot panel (mode control panel): a block whose face tilts up toward the pilot
    const tilt = -0.7; // radians
    const panel = new THREE.Group();
    panel.position.set(CX, -0.085, -0.78);
    panel.rotation.x = tilt;
    this.group.add(panel);
    this.box(panel, 0.58, 0.1, 0.1, mcp, 0, 0, 0);
    const FZ = 0.05; // face plane (local z)
    for (let i = 0; i < 6; i++) {
      const x = -0.25 + i * 0.1;
      this.box(panel, 0.066, 0.028, 0.004, dispBg, x, 0.03, FZ + 0.002);   // display
      this.box(panel, 0.05, 0.012, 0.002, dispOn, x, 0.03, FZ + 0.005);    // lit digits
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.014, 16), knob);
      k.rotation.x = Math.PI / 2;                                         // knob points at the pilot
      k.position.set(x, 0.0, FZ + 0.007);
      panel.add(k);
      this.box(panel, 0.032, 0.012, 0.008, btn, x, -0.032, FZ + 0.004);    // button
    }

    // Warning lights: red fire warn + amber master caution, one pair each side of the panel
    const lights = (x0, dir) => {
      const g = new THREE.Group();
      g.position.set(x0, -0.078, -0.72);
      g.rotation.x = tilt;
      this.group.add(g);
      this.box(g, 0.05, 0.034, 0.012, fire, 0, 0, 0);
      this.box(g, 0.05, 0.034, 0.012, caution, dir * 0.07, 0, 0);
    };
    lights(0.04, 1);          // captain: fire at x 0.04, caution at x 0.11
    lights(0.96, -1);         // first officer: mirrored
  }

  // ---- PIECE 3: main instrument panel (blank screens: capt PFD, ND, centre unit, F/O ND, F/O PFD) ----
  buildMainPanel() {
    const { panel: pm, bezel, center, screen, gearOn } = this.m;
    const CX = 0.5;

    // Solid fill behind the panel so there are no gaps (stays behind the tilted face)
    this.slab(-0.55, 1.55, -1.15, -0.2, -0.9, -0.76, pm);

    // Tilted panel: top tucks under the glareshield, bottom leans toward the pilot
    const p = new THREE.Group();
    p.position.set(0, -0.42, -0.62);
    p.rotation.x = -0.4;
    this.group.add(p);
    this.box(p, 2.1, 0.6, 0.05, pm, CX, 0, 0);

    // Big screens: 0.26 m square with a bezel
    const FACE = 0.025;
    const bigScreen = x => {
      this.box(p, 0.285, 0.285, 0.012, bezel, x, 0, FACE + 0.006);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), screen);
      s.position.set(x, 0, FACE + 0.0125);
      p.add(s);
    };
    [-0.03, 0.26, 0.74, 1.03].forEach(bigScreen);

    // Centre unit between the pilots: small standby display + three gear lights
    this.box(p, 0.18, 0.5, 0.02, center, CX, 0, 0.035);
    this.box(p, 0.11, 0.11, 0.004, bezel, CX, 0.12, 0.0455);
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.095, 0.095), screen);
    sm.position.set(CX, 0.12, 0.0485);
    p.add(sm);
    [-0.04, 0, 0.04].forEach(dx => this.box(p, 0.028, 0.03, 0.008, gearOn, CX + dx, -0.02, 0.049));
  }

  // Model only for now; screens come alive in a later step
  update(f) {}
}
