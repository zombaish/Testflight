// Final Approach - cockpit.js (v0.5.1)
// Cockpit rebuild: MODEL ONLY, no function yet. Built in metres.
// Origin = captain's eyes, -z forward, +x right, +y up. Aircraft centreline is x = 0.5.
//
// NAMES: every part has a unique name, set on mesh.name and stored in this.parts, e.g.
//   cockpit.parts["MCP_HEADING_KNOB"]  -> that mesh. Use these when adding functions.
// Pattern: AREA_THING_TYPE  (MCP_ALT_HOLD_BUTTON, DISPLAY_PFD_CAPT, GLARE_FIRE_WARN_CAPT_LIGHT).
// CAPT = captain (left seat, x about 0), FO = first officer (right seat, x about 1).
// Lights, display digits and screens each have their OWN material (part.material), so each
// one can glow / change colour on its own later, e.g. parts["GEAR_LIGHT_NOSE"].material.color.set(0x00ff40).
// LIGHTING (v0.5.1): cockpit.setNight(0..1) dims the interior surfaces; each light/display/screen
//   glows from its dim "off" colour to a bright "on" colour:
//   cockpit.setGlow("GEAR_LIGHT_NOSE", 1)  -> one light fully on;  cockpit.setGlowAll(1) -> every light on (demo).
// In the game, tap NAMES (top right) then tap any part to see its name.
//
// Build order: 1 shell (done) > 2 glareshield (done) > 3 main panel + screens (done) > 4 yokes (done)
//              > 5 centre pedestal (done) > 6 overhead panel (done) > 7 seats + sit/stand + collisions (done) > 8 side consoles, radio panels, pedals, door, details (done) = MODEL COMPLETE
class Cockpit {
  constructor() {
    this.group = new THREE.Group();
    this.parts = {}; // name -> mesh/group
    this.colliders = []; // floor-plan boxes the walking player cannot enter: {name, x0, x1, z0, z1}
    this.seats = [];     // {name, x, z}: where the eyes are when sitting
    this.interior = [];  // {mat, base}: surfaces dimmed by setNight()
    this.glow = [];      // parts that can glow (see setupGlow)
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
      yoke: this.mat(0x1c1e22),
      grip: this.mat(0x121316),
      hub: this.mat(0x26292e),
      column: this.mat(0x2c2f35),
      apRed: this.mat(0x9a1e1e),
      ped: this.mat(0x2c3036),
      ohBody: this.mat(0x2b2e34),
      ohPlate: this.mat(0x3a3f47),
      seat: this.mat(0x464a52),
      seatDark: this.mat(0x24262a),
      door: this.mat(0x5c636d),
      domeLight: new THREE.MeshBasicMaterial({ color: 0x6a6a62 }),
    };
    this.buildShell();
    this.buildGlareshield();
    this.buildMainPanel();
    this.buildYokes();
    this.buildPedestal();
    this.buildOverhead();
    this.buildSeats();
    this.buildPedestalAft();
    this.buildConsoles();
    this.buildDetails();
    this.buildColliders();
    this.setupGlow();
  }

  // Mostly emissive with a little diffuse shading, so the outdoor hemisphere light
  // (green from the ground colour) doesn't tint the interior
  mat(color) {
    const m = new THREE.MeshLambertMaterial({
      color: new THREE.Color(color).multiplyScalar(0.35),
      emissive: color,
      emissiveIntensity: 0.65,
    });
    this.interior.push({ mat: m, base: 0.65 });
    return m;
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

  // Cylinder between two points (in the parent's space)
  rod(parent, p0, p1, r, mat, name) {
    const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1);
    const dir = b.clone().sub(a), len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    parent.add(m);
    return this.tag(m, name);
  }

  sphere(parent, r, mat, x, y, z, name) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return this.tag(m, name);
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
      this.box(panel, 0.05, 0.012, 0.002, dispOn.clone(), x, 0.038, FZ + 0.005, "MCP_" + id + "_DISPLAY_DIGITS");
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
      this.box(g, 0.05, 0.034, 0.012, fire.clone(), 0, 0, 0, "GLARE_FIRE_WARN_" + who + "_LIGHT");
      this.box(g, 0.05, 0.034, 0.012, caution.clone(), dir * 0.07, 0, 0, "GLARE_MASTER_CAUTION_" + who + "_LIGHT");
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
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), screen.clone());
      s.position.set(x, 0, FACE + 0.0125);
      p.add(s);
      this.tag(s, "DISPLAY_" + id);
    });

    // Centre unit between the pilots: standby display (ISFD) + landing gear lights
    this.box(p, 0.18, 0.5, 0.02, center, CX, 0, 0.035, "PANEL_CENTER_UNIT");
    this.box(p, 0.11, 0.11, 0.004, bezel, CX, 0.12, 0.0455, "DISPLAY_STANDBY_ISFD_BEZEL");
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.095, 0.095), screen.clone());
    sm.position.set(CX, 0.12, 0.0485);
    p.add(sm);
    this.tag(sm, "DISPLAY_STANDBY_ISFD");
    [["LEFT", -0.04], ["NOSE", 0], ["RIGHT", 0.04]].forEach(([n, dx]) =>
      this.box(p, 0.028, 0.03, 0.008, gearOn.clone(), CX + dx, -0.02, 0.049, "GEAR_LIGHT_" + n));
  }

  // ---- PIECE 4: control columns + yokes (captain x = 0, first officer x = 1) ----
  buildYokes() {
    const { yoke, grip, hub, column, btn, apRed } = this.m;
    [["CAPT", 0.0, -1], ["FO", 1.0, 1]].forEach(([who, x, out]) => { // out = which side is outboard
      const n = "YOKE_" + who + "_";

      // Column: from the floor, leaning toward the pilot, up to the yoke hub
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 16), column);
      base.position.set(x, -1.125, -0.585);
      this.group.add(base);
      this.tag(base, n + "COLUMN_BASE");
      this.rod(this.group, [x, -1.12, -0.585], [x, -0.58, -0.41], 0.025, column, n + "COLUMN");

      // Yoke: hub + two horns, plane tilted up toward the pilot's face
      const g = new THREE.Group();
      g.position.set(x, -0.55, -0.4);
      g.rotation.x = -0.25;
      this.group.add(g);
      this.tag(g, n + "ASSEMBLY");
      this.box(g, 0.11, 0.075, 0.07, hub, 0, 0, 0, n + "HUB");
      [-1, 1].forEach(s => {
        const side = s < 0 ? "LEFT" : "RIGHT";
        this.rod(g, [s * 0.05, 0, 0], [s * 0.15, 0.04, 0], 0.014, yoke, n + "ARM_" + side);
        this.sphere(g, 0.016, yoke, s * 0.15, 0.04, 0, n + "ELBOW_" + side);
        this.rod(g, [s * 0.15, 0.04, 0], [s * 0.168, 0.2, 0], 0.015, yoke, n + "HORN_" + side);
        this.rod(g, [s * 0.165, 0.12, 0], [s * 0.168, 0.215, 0], 0.021, grip, n + "GRIP_" + side);
      });

      // Switches. Hub face: the two stabiliser trim switches (both must move to trim).
      this.box(g, 0.03, 0.018, 0.008, btn, -0.025, 0, 0.039, n + "TRIM_SWITCH_A");
      this.box(g, 0.03, 0.018, 0.008, btn, 0.025, 0, 0.039, n + "TRIM_SWITCH_B");
      // Outboard horn: autopilot disconnect (red) and push-to-talk
      this.box(g, 0.02, 0.02, 0.01, apRed, out * 0.158, 0.1, 0.02, n + "AP_DISCONNECT_BUTTON");
      this.box(g, 0.02, 0.022, 0.012, btn, out * 0.167, 0.17, 0.027, n + "PTT_BUTTON");
    });
  }

  // ---- PIECE 5: centre pedestal (thrust levers, speedbrake, flaps, fuel levers, trim wheels, CDUs) ----
  // Engine 1 = left engine (x 0.45 lever), engine 2 = right engine (x 0.55 lever).
  buildPedestal() {
    const { ped, center, yoke, grip, btn, apRed, bezel, screen } = this.m;
    const T = -0.64; // pedestal top surface
    const G = this.group;
    this.slab(0.28, 0.72, -1.15, T, -0.76, 0.25, ped, "PEDESTAL_BODY");
    this.slab(0.28, 0.72, T, T + 0.008, -0.76, 0.25, center, "PEDESTAL_TOP");
    this.slab(0.42, 0.58, T + 0.008, T + 0.011, -0.34, -0.18, bezel, "PEDESTAL_THRUST_LEVER_SLOT");

    // Thrust levers: handle with TO/GA button on the front and A/T disconnect on the outboard side
    [[1, 0.45, -1], [2, 0.55, 1]].forEach(([i, x, out]) => {
      const p = "PEDESTAL_THRUST_LEVER_" + i;
      this.rod(G, [x, T, -0.3], [x, -0.45, -0.24], 0.01, yoke, p);
      this.box(G, 0.04, 0.05, 0.07, grip, x, -0.43, -0.24, p + "_HANDLE");
      this.box(G, 0.025, 0.02, 0.006, btn, x, -0.43, -0.278, p + "_TOGA_BUTTON");
      this.box(G, 0.008, 0.02, 0.02, apRed, x + out * 0.024, -0.43, -0.24, p + "_AT_DISCONNECT_BUTTON");
      this.rod(G, [x, -0.56, -0.28], [x, -0.56, -0.35], 0.008, yoke, "PEDESTAL_REVERSE_THRUST_LEVER_" + i);
    });

    // Speedbrake lever (captain's side of the thrust levers) and flap lever (first officer's side)
    this.rod(G, [0.395, T, -0.3], [0.395, -0.5, -0.24], 0.008, yoke, "PEDESTAL_SPEEDBRAKE_LEVER");
    this.sphere(G, 0.018, grip, 0.395, -0.495, -0.238, "PEDESTAL_SPEEDBRAKE_KNOB");
    this.rod(G, [0.605, T, -0.3], [0.605, -0.52, -0.24], 0.008, yoke, "PEDESTAL_FLAP_LEVER");
    this.box(G, 0.03, 0.03, 0.04, grip, 0.605, -0.515, -0.238, "PEDESTAL_FLAP_LEVER_HANDLE");

    // Engine fuel control levers (cutoff / idle) and parking brake
    [[1, 0.46], [2, 0.54]].forEach(([i, x]) => {
      this.rod(G, [x, T, -0.12], [x, -0.58, -0.1], 0.007, yoke, "PEDESTAL_FUEL_CONTROL_LEVER_" + i);
      this.sphere(G, 0.014, grip, x, -0.575, -0.098, "PEDESTAL_FUEL_CONTROL_LEVER_" + i + "_KNOB");
    });
    this.rod(G, [0.6, T, 0.0], [0.6, -0.56, -0.02], 0.01, apRed, "PEDESTAL_PARKING_BRAKE_LEVER");

    // Stabiliser trim wheels, one each side of the pedestal
    [["CAPT", 0.28], ["FO", 0.72]].forEach(([who, x]) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.025, 20), grip);
      w.rotation.z = Math.PI / 2; // axis along x
      w.position.set(x, -0.66, -0.18);
      G.add(w);
      this.tag(w, "PEDESTAL_STAB_TRIM_WHEEL_" + who);
    });

    // Flight computer control display units (CDU): screen + keypad, tilted up toward the pilot
    [["CAPT", 0.34], ["FO", 0.66]].forEach(([who, x]) => {
      const n = "PEDESTAL_CDU_" + who + "_";
      const g = new THREE.Group();
      g.position.set(x, -0.62, -0.38);
      g.rotation.x = -0.5;
      G.add(g);
      this.tag(g, n + "ASSEMBLY");
      this.box(g, 0.12, 0.17, 0.04, bezel, 0, 0, 0, n + "BODY");
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.07), screen.clone());
      s.position.set(0, 0.04, 0.0205);
      g.add(s);
      this.tag(s, n + "SCREEN");
      this.box(g, 0.105, 0.075, 0.008, btn, 0, -0.035, 0.024, n + "KEYPAD");
    });
  }

  // One group of controls on a panel plate. dir: -1 = face points down (overhead), +1 = face points up (pedestal top).
  // items: [name, kind, hasLight]; kind: sw (toggle, default), knob, guard (guarded switch), handle (fire handle), display
  section(g, dir, prefix, id, cx, cz, w, d, cols, items, lightMat) {
    const { btn, knob, apRed, ohPlate, dispOn } = this.m;
    const pre = prefix + id + "_";
    const Y0 = dir * 0.026;
    const y = h => Y0 + dir * h; // centre height of a part h tall sitting on the plate
    this.box(g, w, 0.006, d, ohPlate, cx, dir * 0.023, cz, pre + "PLATE");
    const rows = [];
    for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
    const rowSp = d / rows.length, colSp = w / cols;
    rows.forEach((row, r) => row.forEach(([name, kind, light], c) => {
      const x = cx + (c - (row.length - 1) / 2) * colSp;
      const z = cz + (r - (rows.length - 1) / 2) * rowSp;
      const nm = pre + name;
      if (kind === "knob") {
        const k = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.024, 16), knob);
        k.position.set(x, y(0.012), z + 0.008);
        g.add(k);
        this.tag(k, nm);
      } else if (kind === "guard") {
        this.box(g, 0.026, 0.024, 0.026, apRed, x, y(0.012), z + 0.008, nm);
      } else if (kind === "handle") {
        this.box(g, 0.044, 0.03, 0.03, apRed, x, y(0.015), z + 0.008, nm);
      } else if (kind === "display") {
        this.box(g, 0.07, 0.01, 0.026, dispOn.clone(), x, y(0.005), z, nm);
      } else {
        this.box(g, 0.018, 0.03, 0.018, btn, x, y(0.015), z + 0.008, nm);
      }
      if (light) {
        const ln = pre + name.replace(/_(SWITCH|KNOB|HANDLE|BUTTON)$/, "") + "_LIGHT";
        this.box(g, 0.026, 0.006, 0.012, lightMat.clone(), x, y(0.003), z - 0.02, ln);
      }
    }));
  }

  // ---- PIECE 6: overhead panel (tilted from the ceiling, 11 sections of switches, knobs, handles + lights) ----
  // Names: OH_<SECTION>_<THING>, e.g. OH_FUEL_PUMP_L_FWD_SWITCH with its light OH_FUEL_PUMP_L_FWD_LIGHT.
  buildOverhead() {
    const { btn, knob, apRed, fire, caution, ohBody, ohPlate } = this.m;
    const g = new THREE.Group();
    g.position.set(0.5, 0.54, -0.64);
    g.rotation.x = 0.4; // front edge up at the ceiling, pilot edge hangs lower
    this.group.add(g);
    this.tag(g, "OVERHEAD_PANEL");
    this.box(g, 0.9, 0.04, 0.52, ohBody, 0, 0, 0, "OVERHEAD_BODY");
    const Y0 = -0.026; // face of the section plates (local y, pointing down)

    const section = (...a) => this.section(g, -1, "OH_", ...a);
    const L = true; // shorthand: this item has a light

    // Row 1 (front, next to the windshield)
    section("ELEC", -0.30, -0.17, 0.28, 0.14, 3, [
      ["BATTERY_SWITCH"], ["STANDBY_POWER_SWITCH"], ["GEN_1_SWITCH", "sw", L],
      ["GEN_2_SWITCH", "sw", L], ["APU_GEN_1_SWITCH", "sw", L], ["APU_GEN_2_SWITCH", "sw", L]], caution);
    section("FUEL", -0.01, -0.17, 0.28, 0.14, 4, [
      ["PUMP_L_FWD_SWITCH", "sw", L], ["PUMP_L_AFT_SWITCH", "sw", L], ["PUMP_R_AFT_SWITCH", "sw", L], ["PUMP_R_FWD_SWITCH", "sw", L],
      ["PUMP_CTR_L_SWITCH", "sw", L], ["PUMP_CTR_R_SWITCH", "sw", L], ["CROSSFEED_SWITCH"]], caution);
    section("HYD", 0.225, -0.17, 0.17, 0.14, 2, [
      ["ENG_1_PUMP_SWITCH", "sw", L], ["ENG_2_PUMP_SWITCH", "sw", L],
      ["ELEC_1_PUMP_SWITCH", "sw", L], ["ELEC_2_PUMP_SWITCH", "sw", L]], caution);
    section("APU", 0.385, -0.17, 0.13, 0.14, 2, [["MASTER_SWITCH", "sw", L], ["START_SWITCH"]], caution);

    // Row 2 (middle)
    section("ENG", -0.30, 0.0, 0.28, 0.14, 3, [
      ["START_1_KNOB", "knob"], ["IGNITION_SELECT_KNOB", "knob"], ["START_2_KNOB", "knob"]], caution);
    section("AIR", -0.01, 0.0, 0.28, 0.14, 3, [
      ["PACK_L_SWITCH", "sw", L], ["PACK_R_SWITCH", "sw", L], ["APU_BLEED_SWITCH", "sw", L],
      ["BLEED_1_SWITCH", "sw", L], ["BLEED_2_SWITCH", "sw", L], ["ISOLATION_VALVE_SWITCH"]], caution);
    section("ANTI_ICE", 0.225, 0.0, 0.17, 0.14, 3, [
      ["ENG_1_SWITCH", "sw", L], ["WING_SWITCH", "sw", L], ["ENG_2_SWITCH", "sw", L]], caution);
    section("SIGNS", 0.385, 0.0, 0.13, 0.14, 2, [["SEATBELT_SIGN_SWITCH"], ["NO_SMOKING_SWITCH"]], caution);

    // Row 3 (pilot edge)
    section("LIGHTS", -0.25, 0.17, 0.38, 0.14, 5, [
      ["LANDING_L_SWITCH"], ["LANDING_R_SWITCH"], ["RUNWAY_TURNOFF_L_SWITCH"], ["RUNWAY_TURNOFF_R_SWITCH"], ["TAXI_SWITCH"],
      ["STROBE_SWITCH"], ["POSITION_SWITCH"], ["LOGO_SWITCH"], ["WING_SWITCH"]], caution);
    section("FIRE", 0.07, 0.17, 0.26, 0.14, 3, [
      ["ENG_1_FIRE_HANDLE", "handle", L], ["APU_FIRE_HANDLE", "handle", L], ["ENG_2_FIRE_HANDLE", "handle", L],
      ["FIRE_TEST_SWITCH"], ["BELL_CUTOUT_BUTTON"]], fire);
    section("MISC", 0.31, 0.17, 0.26, 0.14, 3, [
      ["EMER_EXIT_LIGHTS_SWITCH", "guard"], ["PASS_OXYGEN_SWITCH", "guard"], ["WINDOW_HEAT_SWITCH"]], caution);
  }

  // ---- PIECE 7: pilot seats (captain x = 0, first officer x = 1) + collision boxes ----
  // Eyes sit at (seat x, 0, 0). Names: SEAT_<CAPT|FO>_<PART>.
  buildSeats() {
    const { seat, seatDark, column, btn, yoke } = this.m;
    const G = this.group;
    [["CAPT", 0.0], ["FO", 1.0]].forEach(([who, x]) => {
      const n = "SEAT_" + who + "_";
      this.seats.push({ name: who, x, z: 0 });
      this.colliders.push({ name: n + "COLLIDER", x0: x - 0.27, x1: x + 0.27, z0: -0.22, z1: 0.4 });

      this.box(G, 0.42, 0.03, 0.8, seatDark, x, -1.135, 0.12, n + "RAILS");
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.24, 16), column);
      post.position.set(x, -1.0, 0.05);
      G.add(post);
      this.tag(post, n + "BASE_POST");
      this.box(G, 0.46, 0.1, 0.48, seat, x, -0.83, 0.04, n + "CUSHION");
      this.box(G, 0.46, 0.6, 0.09, seat, x, -0.48, 0.33, n + "BACKREST").rotation.x = 0.12;
      this.box(G, 0.3, 0.18, 0.08, seat, x, -0.14, 0.37, n + "HEADREST").rotation.x = 0.12;
      this.box(G, 0.05, 0.04, 0.28, seatDark, x - 0.245, -0.62, 0.1, n + "ARMREST_LEFT");
      this.box(G, 0.05, 0.04, 0.28, seatDark, x + 0.245, -0.62, 0.1, n + "ARMREST_RIGHT");
      this.rod(G, [x - 0.24, -0.86, -0.1], [x - 0.3, -0.86, -0.02], 0.008, yoke, n + "HEIGHT_ADJUST_LEVER");
      this.box(G, 0.04, 0.01, 0.07, btn, x + 0.18, -0.775, 0.0, n + "SEATBELT_BUCKLE");
    });
  }

  // Floor-plan collision boxes for the big solid things (seats add their own above)
  buildColliders() {
    this.colliders.push({ name: "PEDESTAL_COLLIDER", x0: 0.25, x1: 0.75, z0: -0.76, z1: 0.25 });
    [0.0, 1.0].forEach((x, i) =>
      this.colliders.push({ name: "YOKE_" + (i ? "FO" : "CAPT") + "_COLUMN_COLLIDER", x0: x - 0.05, x1: x + 0.05, z0: -0.62, z1: -0.38 }));
  }

  // ---- PIECE 8a: pedestal aft panels (radios, transponder, trim) on the pedestal top, behind the levers ----
  buildPedestalAft() {
    const g = new THREE.Group();
    g.position.set(0.5, -0.652, 0.0); // plates sit on the pedestal top (y -0.632)
    this.group.add(g);
    this.tag(g, "PEDESTAL_AFT_PANELS");
    const sec = (...a) => this.section(g, 1, "PEDESTAL_", ...a);
    const radio = ["FREQ_DISPLAY", "display"], tune = ["FREQ_KNOB", "knob"];
    sec("RADIO_COMM_1", -0.15, 0.10, 0.135, 0.085, 1, [radio, tune]);
    sec("RADIO_COMM_2", 0.0, 0.10, 0.135, 0.085, 1, [radio, tune]);
    sec("RADIO_NAV", 0.15, 0.10, 0.135, 0.085, 1, [radio, tune]);
    sec("TRANSPONDER", -0.12, 0.19, 0.2, 0.085, 3, [["MODE_KNOB", "knob"], ["IDENT_BUTTON"], ["CODE_KNOB", "knob"]]);
    sec("TRIM", 0.12, 0.19, 0.2, 0.085, 3, [["RUDDER_TRIM_KNOB", "knob"], ["AILERON_TRIM_SWITCH_A"], ["AILERON_TRIM_SWITCH_B"]]);
  }

  // ---- PIECE 8b: side consoles (captain left, first officer right) ----
  buildConsoles() {
    const { ped, center, grip, yoke, knob, bezel } = this.m;
    const G = this.group;
    [["CAPT", -0.55, -0.3, -1], ["FO", 1.3, 1.55, 1]].forEach(([who, x0, x1, side]) => {
      const n = "CONSOLE_" + who + "_";
      const cx = (x0 + x1) / 2, wallX = side < 0 ? -0.52 : 1.52;
      this.slab(x0, x1, -1.15, -0.62, -0.45, 0.45, ped, n + "BODY");
      this.slab(x0, x1, -0.62, -0.612, -0.45, 0.45, center, n + "TOP");
      this.colliders.push({ name: n + "COLLIDER", x0, x1, z0: -0.45, z1: 0.45 });
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.03, 16), bezel);
      cup.position.set(cx, -0.6, 0.3);
      G.add(cup);
      this.tag(cup, n + "CUP_HOLDER");
      const ml = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 12), knob);
      ml.position.set(cx, -0.605, 0.12);
      G.add(ml);
      this.tag(ml, n + "MAP_LIGHT_KNOB");
      this.box(G, 0.025, 0.025, 0.025, bezel, cx, -0.612, 0.42, n + "HEADSET_JACK");
      this.box(G, 0.06, 0.12, 0.14, bezel, wallX, -0.34, 0.16, n + "OXYGEN_MASK_BOX");
      this.box(G, 0.03, 0.02, 0.06, this.m.btn, wallX, -0.095, -0.2, "WINDOW_SIDE_" + (side < 0 ? "LEFT" : "RIGHT") + "_LATCH");
      if (who === "CAPT") { // nose wheel steering tiller
        this.rod(G, [cx, -0.62, -0.15], [cx, -0.52, -0.1], 0.01, yoke, n + "TILLER_HANDLE");
        this.sphere(G, 0.02, grip, cx, -0.51, -0.095, n + "TILLER_KNOB");
      }
    });
  }

  // ---- PIECE 8c: details (rudder pedals, door, ceiling lights, sun visors, extinguisher) ----
  buildDetails() {
    const { seatDark, door, bezel, btn, apRed, domeLight } = this.m;
    const G = this.group;
    [["CAPT", 0.0], ["FO", 1.0]].forEach(([who, x]) => {
      ["LEFT", "RIGHT"].forEach((side, i) => {
        this.box(G, 0.11, 0.17, 0.025, seatDark, x + (i ? 0.1 : -0.1), -0.98, -0.5, "RUDDER_PEDAL_" + who + "_" + side).rotation.x = -0.7;
      });
    });
    // Cockpit door on the back wall
    this.slab(0.12, 0.88, -1.15, 0.5, 1.17, 1.2, door, "COCKPIT_DOOR");
    this.box(G, 0.1, 0.02, 0.03, btn, 0.78, -0.35, 1.155, "COCKPIT_DOOR_HANDLE");
    this.box(G, 0.03, 0.03, 0.02, apRed, 0.78, -0.45, 1.16, "COCKPIT_DOOR_LOCK_KNOB");
    const peep = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 12), bezel);
    peep.rotation.x = Math.PI / 2;
    peep.position.set(0.5, 0.2, 1.165);
    G.add(peep);
    this.tag(peep, "COCKPIT_DOOR_PEEPHOLE");
    // Ceiling lights (own materials so they can glow) and sun visors (stowed against the ceiling)
    this.box(G, 0.14, 0.012, 0.09, domeLight.clone(), 0.5, 0.644, 0.35, "CEILING_DOME_LIGHT");
    this.box(G, 0.05, 0.012, 0.05, domeLight.clone(), -0.05, 0.644, 0.1, "CEILING_MAP_LIGHT_CAPT");
    this.box(G, 0.05, 0.012, 0.05, domeLight.clone(), 1.05, 0.644, 0.1, "CEILING_MAP_LIGHT_FO");
    this.box(G, 0.4, 0.012, 0.28, seatDark, -0.15, 0.63, -0.62, "SUNVISOR_CAPT");
    this.box(G, 0.4, 0.012, 0.28, seatDark, 1.15, 0.63, -0.62, "SUNVISOR_FO");
    const fe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 16), apRed);
    fe.position.set(1.4, -1.0, 1.1);
    G.add(fe);
    this.tag(fe, "CABIN_FIRE_EXTINGUISHER");
  }

  // ---- LIGHTING: night dimming + glowing lights ----
  // Find every light / lit display / screen (flat-colour parts) and give it an "on" colour to glow toward.
  setupGlow() {
    const pick = n => {
      if (n.startsWith("CEILING_")) return 0xfff0cc;                 // dome + map lights: warm white
      if (n.startsWith("GEAR_LIGHT_")) return 0x35ff55;              // gear lights: green
      if (/FIRE_WARN|_FIRE_LIGHT/.test(n)) return 0xff3030;          // fire warning: red
      if (n.endsWith("_LIGHT")) return 0xffb030;                     // annunciators, master caution: amber
      if (n.endsWith("_DISPLAY_DIGITS") || n.endsWith("FREQ_DISPLAY")) return 0xffa020; // lit digits
      if ((n.startsWith("DISPLAY_") && !n.endsWith("_BEZEL")) || n.endsWith("_SCREEN")) return 0x14384c; // screens: soft blue
      return null;
    };
    for (const name of Object.keys(this.parts)) {
      const part = this.parts[name], mat = part.material;
      if (!mat || !mat.isMeshBasicMaterial) continue;
      const hex = pick(name);
      if (hex === null) continue;
      part.userData.glow = { off: mat.color.clone(), on: new THREE.Color(hex) };
      this.glow.push(part);
    }
  }

  // 0 = day, 1 = night: dims the interior surfaces (lights are separate, see setGlow)
  setNight(t) {
    const level = 1 - 0.85 * t;
    for (const i of this.interior) i.mat.emissiveIntensity = i.base * level;
  }

  // One light/display/screen: a = 0 (dim, off) .. 1 (fully glowing)
  setGlow(name, a) {
    const p = this.parts[name], g = p && p.userData.glow;
    if (g) p.material.color.copy(g.off).lerp(g.on, a);
  }

  // Every light at once (used by the NIGHT demo)
  setGlowAll(a) {
    for (const p of this.glow) p.material.color.copy(p.userData.glow.off).lerp(p.userData.glow.on, a);
  }

  // Model only for now; screens come alive in a later step
  update(f) {}
}
