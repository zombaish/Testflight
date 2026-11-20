// Final Approach - cockpit.js (v0.4.0)
// Cockpit rebuild: MODEL ONLY, no function yet. Built in metres.
// Origin = captain's eyes, -z forward, +x right, +y up. Aircraft centreline is x = 0.5.
// Build order: 1 shell (done) > 2 glareshield > 3 main panel + screens > 4 yokes
//              > 5 centre pedestal > 6 overhead panel > 7 seats, side consoles, details
class Cockpit {
  constructor() {
    this.group = new THREE.Group();
    this.m = {
      wall: this.mat(0x6f7782),
      ceil: this.mat(0x8b929b),
      floor: this.mat(0x2a2d32),
      trim: this.mat(0x2e3238),
    };
    this.buildShell();
  }

  // Lambert with some emissive so the interior isn't tinted by the outdoor hemisphere light
  mat(color) {
    return new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.4 });
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

  // Model only for now; screens come alive in a later step
  update(f) {}
}
