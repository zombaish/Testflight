// Final Approach - cockpit.js (v0.4.5)
// Cockpit rebuild: MODEL ONLY, no function yet. Built in metres.
// Origin = captain's eyes, -z forward, +x right, +y up. Aircraft centreline is x = 0.5.
//
// NAMES: every part has a unique name, set on mesh.name and stored in this.parts, e.g.
//   cockpit.parts["MCP_HEADING_KNOB"]  -> that mesh. Use these when adding functions.
// Pattern: AREA_THING_TYPE  (MCP_ALT_HOLD_BUTTON, DISPLAY_PFD_CAPT, GLARE_FIRE_WARN_CAPT_LIGHT).
// CAPT = captain (left seat, x about 0), FO = first officer (right seat, x about 1).
// In the game, tap NAMES (top right) then tap any part to see its name.
//
// Build order: 1 shell (done) > 2 glareshield (done) > 3 main panel + screens (done) > 4 yokes
//              > 5 centre pedestal > 6 overhead panel > 7 seats (+ sit/stand buttons), side consoles, details
class Cockpit {
  constructor() {
    this.group = new THREE.Group();
    this.parts = {}; // name -> mesh/group
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

  // Give a part its unique name and register it in this.parts
  tag(obj, name) {
    if (name) {
      if (this.parts[name]) console.warn("Cockpit: duplicate part name " + name);
      obj.name = name;
      this.parts[name] = obj;
    }
    return obj;
  }

  // Box added to any parent, centred at x,y,z
  box(parent, w, h, d, mat, x, y, z, name) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return this.tag(m, name);
  }

  // Box from min/max corners (easier to line pieces up than centre + size), added to the cockpit
  slab(x0, x1, y0, y1, z0, z1, mat, name) {
    return this.box(this.group, x1 - x0, y1 - y0, z1 - z0, mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, name);
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
    s(L - T, R + T, FLOOR - T, FLOOR, F, B, floor, "SHELL_FLOOR");
    s(L - T, R + T, CEIL, CEIL + T, F, B, ceil, "SHELL_CEILING");
    s(L - T, R + T, FLOOR, CEIL, BACK, B, wall, "SHELL_BACK_WALL");

    // Front wall with two windshield openings: left x -0.40..0.45, right x 0.55..1.40
    s(L - T, R + T, FLOOR, WY0, F, FRONT, wall, "SHELL_FRONT_WALL_LOWER");
    s(L - T, R + T, WY1, CEIL, F, FRONT, wall, "SHELL_FRONT_WALL_UPPER");
    s(L - T, -0.40, WY0, WY1, F, FRONT, wall, "SHELL_WINDSHIELD_PILLAR_LEFT");
    s(0.45, 0.55, WY0, WY1, F, FRONT, wall, "SHELL_WINDSHIELD_POST_CENTRE");
    s(1.40, R + T, WY0, WY1, F, FRONT, wall, "SHELL_WINDSHIELD_PILLAR_RIGHT");

    // Side walls with one window each
    const side = (x0, x1, n) => {
      s(x0, x1, FLOOR, WY0, F, BACK, wall, "SHELL_SIDE_WALL_" + n + "_LOWER");
      s(x0, x1, WY1, CEIL, F, BACK, wall, "SHELL_SIDE_WALL_" + n + "_UPPER");
      s(x0, x1, WY0, WY1, F, S0, wall, "SHELL_SIDE_WALL_" + n + "_FORE");
      s(x0, x1, WY0, WY1, S1, BACK, wall, "SHELL_SIDE_WALL_" + n + "_AFT");
    };
    side(L - T, L, "LEFT");
    side(R, R + T, "RIGHT");

    // Window frames (thin strips on the inside face, 3 cm wide)
    const w = 0.03, d = 0.02;
    const frontFrame = (x0, x1, n) => {
      const p = "WINDOW_WINDSHIELD_" + n + "_FRAME_";
      s(x0 - w, x0, WY0 - w, WY1 + w, FRONT, FRONT + d, trim, p + "LEFT");
      s(x1, x1 + w, WY0 - w, WY1 + w, FRONT, FRONT + d, trim, p + "RIGHT");
      s(x0 - w, x1 + w, WY0 - w, WY0, FRONT, FRONT + d, trim, p + "BOTTOM");
      s(x0 - w, x1 + w, WY1, WY1 + w, FRONT, FRONT + d, trim, p + "TOP");
    };
    frontFrame(-0.40, 0.45, "LEFT");
    frontFrame(0.55, 1.40, "RIGHT");
    const sideFrame = (xa, xb, n) => {
      const p = "WINDOW_SIDE_" + n + "_FRAME_";
      s(xa, xb, WY0 - w, WY1 + w, S0 - w, S0, trim, p + "FORE");
      s(xa, xb, WY0 - w, WY1 + w, S1, S1 + w, trim, p + "AFT");
      s(xa, xb, WY0 - w, WY0, S0 - w, S1 + w, trim, p + "BOTTOM");
      s(xa, xb, WY1, WY1 + w, S0 - w, S1 + w, trim, p + "TOP");
    };
    sideFrame(L, L + d, "LEFT");
    sideFrame(R - d, R, "RIGHT");
  }

  // ---- PIECE 2: glareshield (body, autopilot panel = MCP, warning lights) ----
  buildGlareshield() {
    const { glare, mcp, dispBg, dispOn, knob, btn, fire, caution } = this.m;
    const CX = 0.5; // aircraft centreline

    // Body: full width, top at y -0.07 (just under the window sills), 0.4 m deep
    this.slab(-0.55, 1.55, -0.2, -0.07, -0.9, -0.5, glare, "GLARESHIELD_BODY");

    // Mode control panel (MCP, the autopilot panel): face tilts up toward the pilot
    const tilt = -0.7; // radians
    const panel = new THREE.Group();
    panel.position.set(CX, -0.085, -0.78);
    panel.rotation.x = tilt;
    this.group.add(panel);
    this.tag(panel, "MCP_PANEL");
    this.box(panel, 0.58, 0.12, 0.1, mcp, 0, 0, 0, "MCP_BODY");
    const FZ = 0.05; // face plane (local z)

    // Six columns, left to right: each has a display and a knob (wheel for vertical speed)
    const cols = [
      ["COURSE_CAPT", "KNOB"], ["SPEED", "KNOB"], ["HEADING", "KNOB"],
      ["ALTITUDE", "KNOB"], ["VERT_SPEED", "WHEEL"], ["COURSE_FO", "KNOB"],
    ];
    // Upper button row: two per column (flight director / autothrottle / mode selects)
    const modes = [
      ["FD_CAPT_SWITCH", "AT_ARM_SWITCH"], ["N1_BUTTON", "SPEED_BUTTON"],
      ["LVL_CHG_BUTTON", "VNAV_BUTTON"], ["HDG_SEL_BUTTON", "LNAV_BUTTON"],
      ["VOR_LOC_BUTTON", "APP_BUTTON"], ["ALT_HOLD_BUTTON", "VS_BUTTON"],
    ];
    // Lower row: autopilot engage buttons, one per column
    const engage = ["CMD_A_BUTTON", "CMD_B_BUTTON", "CWS_A_BUTTON", "CWS_B_BUTTON", "DISENGAGE_BAR", "FD_FO_SWITCH"];

    cols.forEach(([id, kind], i) => {
      const x = -0.25 + i * 0.1;
      this.box(panel, 0.066, 0.028, 0.004, dispBg, x, 0.038, FZ + 0.002, "MCP_" + id + "_DISPLAY");
      this.box(panel, 0.05, 0.012, 0.002, dispOn, x, 0.038, FZ + 0.005, "MCP_" + id + "_DISPLAY_DIGITS");
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.014, 16), knob);
      k.rotation.x = Math.PI / 2;                       // knob points at the pilot
      k.position.set(x, 0.008, FZ + 0.007);
      panel.add(k);
      this.tag(k, "MCP_" + id + "_" + kind);
      modes[i].forEach((n, j) => this.box(panel, 0.034, 0.012, 0.008, btn, x + (j ? 0.022 : -0.022), -0.018, FZ + 0.004, "MCP_" + n));
      const wide = engage[i] === "DISENGAGE_BAR";
      this.box(panel, wide ? 0.07 : 0.04, 0.012, 0.008, btn, x, -0.042, FZ + 0.004, "MCP_" + engage[i]);
    });

    // Warning lights: red fire warn + amber master caution, one pair each side of the MCP
    const lights = (x0, dir, who) => {
      const g = new THREE.Group();
      g.position.set(x0, -0.078, -0.72);
      g.rotation.x = tilt;
      this.group.add(g);
      this.tag(g, "GLARE_WARNING_LIGHTS_" + who);
      this.box(g, 0.05, 0.034, 0.012, fire, 0, 0, 0, "GLARE_FIRE_WARN_" + who + "_LIGHT");
      this.box(g, 0.05, 0.034, 0.012, caution, dir * 0.07, 0, 0, "GLARE_MASTER_CAUTION_" + who + "_LIGHT");
    };
    lights(0.04, 1, "CAPT");
    lights(0.96, -1, "FO");
  }

  // ---- PIECE 3: main instrument panel (blank screens: capt PFD, ND, centre unit, F/O ND, F/O PFD) ----
  buildMainPanel() {
    const { panel: pm, bezel, center, screen, gearOn } = this.m;
    const CX = 0.5;

    // Solid fill behind the panel so there are no gaps (stays behind the tilted face)
    this.slab(-0.55, 1.55, -1.15, -0.2, -0.9, -0.76, pm, "PANEL_MAIN_FILL");

    // Tilted panel: top tucks under the glareshield, bottom leans toward the pilot
    const p = new THREE.Group();
    p.position.set(0, -0.42, -0.62);
    p.rotation.x = -0.4;
    this.group.add(p);
    this.tag(p, "PANEL_MAIN");
    this.box(p, 2.1, 0.6, 0.05, pm, CX, 0, 0, "PANEL_MAIN_BODY");

    // Big screens: 0.26 m square with a bezel. PFD = primary flight display, ND = navigation display
    const FACE = 0.025;
    [["PFD_CAPT", -0.03], ["ND_CAPT", 0.26], ["ND_FO", 0.74], ["PFD_FO", 1.03]].forEach(([id, x]) => {
      this.box(p, 0.285, 0.285, 0.012, bezel, x, 0, FACE + 0.006, "DISPLAY_" + id + "_BEZEL");
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), screen);
      s.position.set(x, 0, FACE + 0.0125);
      p.add(s);
      this.tag(s, "DISPLAY_" + id);
    });

    // Centre unit between the pilots: standby display (ISFD) + landing gear lights
    this.box(p, 0.18, 0.5, 0.02, center, CX, 0, 0.035, "PANEL_CENTER_UNIT");
    this.box(p, 0.11, 0.11, 0.004, bezel, CX, 0.12, 0.0455, "DISPLAY_STANDBY_ISFD_BEZEL");
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.095, 0.095), screen);
    sm.position.set(CX, 0.12, 0.0485);
    p.add(sm);
    this.tag(sm, "DISPLAY_STANDBY_ISFD");
    [["LEFT", -0.04], ["NOSE", 0], ["RIGHT", 0.04]].forEach(([n, dx]) =>
      this.box(p, 0.028, 0.03, 0.008, gearOn, CX + dx, -0.02, 0.049, "GEAR_LIGHT_" + n));
  }

  // Model only for now; screens come alive in a later step
  update(f) {}
}
