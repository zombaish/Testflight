// Final Approach - main.js
const VERSION = "0.5.2";
document.getElementById("ver").textContent = "v" + VERSION;

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8e8);
scene.fog = new THREE.Fog(0x87b8e8, 3000, 14000);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 30000);

const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xffffff, 0x446644, 1.0);
scene.add(hemi);

// --- Ground ---
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40000, 40000),
  new THREE.MeshLambertMaterial({ color: 0x4f7a3a })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// --- Runway (threshold at z=0, runs toward -z, 3000 m long, 45 m wide) ---
const RWY_LEN = 3000, RWY_W = 45;
const runway = new THREE.Mesh(
  new THREE.PlaneGeometry(RWY_W, RWY_LEN),
  new THREE.MeshLambertMaterial({ color: 0x333333 })
);
runway.rotation.x = -Math.PI / 2;
runway.position.set(0, 0.5, -RWY_LEN / 2);
scene.add(runway);

const white = new THREE.MeshBasicMaterial({ color: 0xffffff });

// Centerline dashes
for (let z = -60; z > -RWY_LEN + 60; z -= 50) {
  const dash = new THREE.Mesh(new THREE.PlaneGeometry(1, 30), white);
  dash.rotation.x = -Math.PI / 2;
  dash.position.set(0, 1, z);
  scene.add(dash);
}

// Threshold bars
for (let i = -8; i <= 8; i++) {
  if (i === 0) continue;
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 30), white);
  bar.rotation.x = -Math.PI / 2;
  bar.position.set(i * 2.4, 1, -20);
  scene.add(bar);
}

// --- Flight model (see flight.js) ---
const flight = new Flight();
const hud = document.getElementById("hud");
hud.style.display = "none"; // tap the version label to toggle this debug readout
document.getElementById("ver").onclick = () => {
  hud.style.display = hud.style.display === "none" ? "" : "none";
};

// --- Pilot rig: moves with the aircraft; the camera (eyes) and cockpit sit inside it ---
const rig = new THREE.Object3D();
scene.add(rig);
rig.add(camera);
const cockpit = new Cockpit();
rig.add(cockpit.group);
const gear = new LandingGear(); // landing gear model (see gear.js)
rig.add(gear.group);

function setFov() {
  camera.fov = innerWidth < innerHeight ? 85 : 65; // wider in portrait
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
setFov();

// --- Look around: drag (touch or mouse) or arrow keys / WASD. C or double-tap recentres ---
camera.rotation.order = "YXZ";
let lookYaw = 0, lookPitch = 0;
const YAW_MAX = 2.4, PITCH_MAX = 1.2; // radians: about 135 deg sideways, 70 deg up/down
const clampLook = () => {
  lookYaw = Math.max(-YAW_MAX, Math.min(YAW_MAX, lookYaw));
  lookPitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, lookPitch));
};

const el = renderer.domElement;
el.style.touchAction = "none"; // stop the browser scrolling/zooming instead of looking
let dragId = null, lastX = 0, lastY = 0, moved = 0, lastTap = 0;
el.addEventListener("pointerdown", e => {
  if (dragId !== null) return; // first finger only
  dragId = e.pointerId; lastX = e.clientX; lastY = e.clientY; moved = 0;
  el.setPointerCapture(e.pointerId);
});
el.addEventListener("pointermove", e => {
  if (e.pointerId !== dragId) return;
  const k = 1.3 * camera.fov * Math.PI / 180 / innerHeight; // radians per pixel
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  moved += Math.abs(dx) + Math.abs(dy);
  if (viewName) { // outside view: drag to orbit around the gear
    orbYaw -= dx * k * 1.5;
    orbPitch += dy * k * 1.5;
  } else {
    lookYaw -= dx * k;   // finger moves right -> look right
    lookPitch -= dy * k; // finger moves up -> look up
    clampLook();
  }
});
const endDrag = e => {
  if (e.pointerId !== dragId) return;
  dragId = null;
  if (moved < 10) { // it was a tap; two quick taps recentre the view
    const now = performance.now();
    if (now - lastTap < 350) { lookYaw = 0; lookPitch = 0; }
    lastTap = now;
    if (showNames) showPartName(e.clientX, e.clientY); else tapPart(e.clientX, e.clientY);
  }
};
el.addEventListener("pointerup", endDrag);
el.addEventListener("pointercancel", endDrag);

const keys = {};
addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (k === "c") { lookYaw = 0; lookPitch = 0; }
  if (k === "e" && !e.repeat) toggleSeat();
  keys[k] = true;
  if (k.startsWith("arrow")) e.preventDefault();
});
addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

// --- Seats: STAND / SIT button (or E). Seated = eyes locked in the seat. Standing = free walking with collisions. ---
let walk = false, walkX = 0, walkY = 0, walkZ = 0, joyX = 0, joyY = 0, seatIdx = 0; // walk = standing
const ui = (tag, css) => {
  const d = document.createElement(tag);
  d.style.cssText = css;
  document.body.appendChild(d);
  return d;
};
const seatBtn = ui("button", "position:fixed;top:8px;right:8px;z-index:5;padding:8px 14px;font:14px monospace;color:#fff;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.5);border-radius:6px");
seatBtn.textContent = "STAND";
const stick = ui("div", "position:fixed;left:24px;bottom:24px;z-index:5;width:110px;height:110px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.35);touch-action:none;display:none");
const nub = document.createElement("div");
nub.style.cssText = "position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(255,255,255,.45);pointer-events:none";
stick.appendChild(nub);

const STAND_Y = 0.3, STAND_Z = 0.6, BODY_R = 0.15; // standing eye height, spot behind the seat, body radius
const toast = ui("div", "position:fixed;bottom:150px;left:50%;transform:translateX(-50%);z-index:5;padding:8px 12px;font:14px monospace;color:#fff;background:rgba(0,0,0,.7);border-radius:6px;pointer-events:none;display:none");
let toastTimer = 0;
function showToast(t) {
  toast.textContent = t; toast.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.display = "none"; }, 1800);
}
function nearSeat() { // index of the seat within reach, or -1
  let best = -1, bd = 0.8;
  cockpit.seats.forEach((s, i) => {
    const d = Math.hypot(walkX - s.x, walkZ - (s.z + 0.2));
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
function toggleSeat() {
  if (walk) { // standing -> sit in the nearest seat
    const i = nearSeat();
    if (i < 0) { showToast("Walk closer to a seat to sit"); return; }
    walk = false; seatIdx = i;
    walkX = cockpit.seats[i].x; walkZ = cockpit.seats[i].z;
  } else {    // seated -> stand up behind the seat
    walk = true;
    walkX = cockpit.seats[seatIdx].x; walkZ = STAND_Z;
  }
  lookYaw = 0; lookPitch = 0; joyX = 0; joyY = 0;
  stick.style.display = walk ? "block" : "none";
}
function pushOut(px, pz) { // keep the walking body out of solid things (cockpit.colliders)
  for (const b of cockpit.colliders) {
    const x0 = b.x0 - BODY_R, x1 = b.x1 + BODY_R, z0 = b.z0 - BODY_R, z1 = b.z1 + BODY_R;
    if (px > x0 && px < x1 && pz > z0 && pz < z1) {
      const k = Math.min(px - x0, x1 - px, pz - z0, z1 - pz);
      if (k === px - x0) px = x0; else if (k === x1 - px) px = x1; else if (k === pz - z0) pz = z0; else pz = z1;
    }
  }
  return [px, pz];
}
seatBtn.addEventListener("click", () => { toggleSeat(); seatBtn.blur(); });

let stickId = null;
const moveStick = e => {
  const r = stick.getBoundingClientRect(), R = 45;
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy);
  if (d > R) { dx *= R / d; dy *= R / d; }
  nub.style.transform = "translate(" + dx + "px," + dy + "px)";
  joyX = dx / R; joyY = -dy / R; // up = forward
};
stick.addEventListener("pointerdown", e => {
  if (stickId !== null) return;
  stickId = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e);
});
stick.addEventListener("pointermove", e => { if (e.pointerId === stickId) moveStick(e); });
const endStick = e => {
  if (e.pointerId !== stickId) return;
  stickId = null; joyX = 0; joyY = 0; nub.style.transform = "";
};
stick.addEventListener("pointerup", endStick);
stick.addEventListener("pointercancel", endStick);

// --- NAMES: turn on, then tap any cockpit part to see its name (matches cockpit.parts) ---
let showNames = false;
const namesBtn = ui("button", "position:fixed;top:52px;right:8px;z-index:5;padding:8px 14px;font:14px monospace;color:#fff;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.5);border-radius:6px");
namesBtn.textContent = "NAMES";
const nameLabel = ui("div", "position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:5;padding:6px 10px;font:14px monospace;color:#ffe27a;background:rgba(0,0,0,.65);border-radius:6px;pointer-events:none;display:none");
namesBtn.addEventListener("click", () => {
  showNames = !showNames;
  namesBtn.textContent = showNames ? "NAMES: ON" : "NAMES";
  if (!showNames) nameLabel.style.display = "none";
  namesBtn.blur();
});
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function partNameAt(x, y) { // name of the cockpit/gear part under a screen point, or ""
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects([cockpit.group, gear.group], true)[0];
  let o = hit && hit.object;
  while (o && !o.name) o = o.parent;
  return o ? o.name : "";
}
function showPartName(x, y) {
  const n = partNameAt(x, y);
  nameLabel.textContent = n;
  nameLabel.style.display = n ? "block" : "none";
}

// --- Night mode: NIGHT / DAY button. Dims the sky and cockpit and makes the cockpit lights glow ---
const daySky = new THREE.Color(0x87b8e8), nightSky = new THREE.Color(0x03050a), skyNow = new THREE.Color();
let nightT = 0, nightGoal = 0;
const nightBtn = ui("button", "position:fixed;top:96px;right:8px;z-index:5;padding:8px 14px;font:14px monospace;color:#fff;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.5);border-radius:6px");
nightBtn.textContent = "NIGHT";
nightBtn.addEventListener("click", () => {
  nightGoal = nightGoal ? 0 : 1;
  nightBtn.textContent = nightGoal ? "DAY" : "NIGHT";
  nightBtn.blur();
});
function updateNight(dt) {
  if (nightT === nightGoal) return;
  const step = Math.min(Math.abs(nightGoal - nightT), dt * 1.2); // about a 1 second fade
  nightT += Math.sign(nightGoal - nightT) * step;
  skyNow.copy(daySky).lerp(nightSky, nightT);
  scene.background.copy(skyNow);
  scene.fog.color.copy(skyNow);
  hemi.intensity = 1 - 0.88 * nightT;
  const w = 1 - 0.65 * nightT;
  white.color.setRGB(w, w, w); // runway markings
  cockpit.setNight(nightT);
  cockpit.setGlowAll(nightT);
  gear.setGlowAll(nightT);
}

// --- Outside views: tap the standby display (or a gear light) to orbit around the landing gear ---
// Edit TAP_VIEWS to choose which part opens which view. Targets are rig-local metres (see gear.js).
const VIEWS = {
  nose: { target: [0.5, -3.0, 1.6], dist: 4 },
  main_left: { target: [-2.1, -3.0, 11.5], dist: 5 },
  main_right: { target: [3.1, -3.0, 11.5], dist: 5 },
};
const TAP_VIEWS = {
  DISPLAY_STANDBY_ISFD: "nose", PANEL_CENTER_UNIT: "nose",
  GEAR_LIGHT_NOSE: "nose", GEAR_LIGHT_LEFT: "main_left", GEAR_LIGHT_RIGHT: "main_right",
};
let viewName = null; // null = you are in the cockpit
let orbYaw = 0.6, orbPitch = 0.45, orbDist = 4;
const BTN = "z-index:5;padding:8px 14px;font:14px monospace;color:#fff;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.5);border-radius:6px;position:fixed;";
const backBtn = ui("button", BTN + "top:52px;left:8px;display:none");
backBtn.textContent = "BACK";
const zoomIn = ui("button", BTN + "bottom:24px;right:8px;display:none");
zoomIn.textContent = "+";
const zoomOut = ui("button", BTN + "bottom:24px;right:60px;display:none");
zoomOut.textContent = "-";
zoomIn.addEventListener("click", () => { orbDist -= 0.7; zoomIn.blur(); });
zoomOut.addEventListener("click", () => { orbDist += 0.7; zoomOut.blur(); });
function enterView(name) {
  viewName = name;
  orbYaw = 0.6; orbPitch = 0.45; orbDist = VIEWS[name].dist;
  for (const b of [backBtn, zoomIn, zoomOut]) b.style.display = "block";
  seatBtn.style.display = "none"; stick.style.display = "none";
}
function leaveView() {
  viewName = null;
  for (const b of [backBtn, zoomIn, zoomOut]) b.style.display = "none";
  seatBtn.style.display = "block"; stick.style.display = walk ? "block" : "none";
}
backBtn.addEventListener("click", () => { leaveView(); backBtn.blur(); });
function tapPart(x, y) {
  if (viewName) return;
  const v = TAP_VIEWS[partNameAt(x, y)];
  if (v) enterView(v);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function updateLook(dt) {
  if (viewName) { // outside view: orbit around the gear (arrows/A-D turn, W-S zoom)
    const r = 1.6 * dt;
    if (keys.arrowleft || keys.a) orbYaw -= r;
    if (keys.arrowright || keys.d) orbYaw += r;
    if (keys.arrowup) orbPitch += r;
    if (keys.arrowdown) orbPitch -= r;
    if (keys.w) orbDist -= 3 * dt;
    if (keys.s) orbDist += 3 * dt;
    orbPitch = clamp(orbPitch, -0.15, 1.45);
    orbDist = clamp(orbDist, 1.5, 12);
    const t = VIEWS[viewName].target, cp = Math.cos(orbPitch);
    const px = t[0] + orbDist * Math.sin(orbYaw) * cp;
    const py = t[1] + orbDist * Math.sin(orbPitch);
    const pz = t[2] + orbDist * Math.cos(orbYaw) * cp;
    camera.position.set(px, py, pz);
    const dx = t[0] - px, dy = t[1] - py, dz = t[2] - pz;
    camera.rotation.set(Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(-dx, -dz), 0);
    return;
  }
  const r = 1.6 * dt; // keyboard turn speed, radians per second
  if (keys.arrowleft || (!walk && keys.a)) lookYaw += r;
  if (keys.arrowright || (!walk && keys.d)) lookYaw -= r;
  if (keys.arrowup || (!walk && keys.w)) lookPitch += r;
  if (keys.arrowdown || (!walk && keys.s)) lookPitch -= r;
  clampLook();

  if (walk) { // WASD or the on-screen stick, relative to where you are looking
    let fx = joyX + (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    let fy = joyY + (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
    const mag = Math.hypot(fx, fy);
    if (mag > 1) { fx /= mag; fy /= mag; }
    const sp = 0.9 * dt, sy = Math.sin(lookYaw), cy = Math.cos(lookYaw);
    walkX = clamp(walkX + (-sy * fy + cy * fx) * sp, -0.4, 1.4);
    walkZ = clamp(walkZ + (-cy * fy - sy * fx) * sp, -0.35, 1.05);
    [walkX, walkZ] = pushOut(walkX, walkZ);
  }
  walkY += ((walk ? STAND_Y : 0) - walkY) * Math.min(1, dt * 6); // ease up/down when standing/sitting
  const lbl = walk ? (nearSeat() >= 0 ? "SIT" : "SIT (go to a seat)") : "STAND";
  if (seatBtn.textContent !== lbl) seatBtn.textContent = lbl;
  camera.position.set(walkX, walkY, walkZ);
  camera.rotation.set(lookPitch, lookYaw, 0);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  flight.step(dt);
  updateLook(dt);
  updateNight(dt);
  if (flight.y <= 0) flight.reset(); // temporary: restart on touchdown
  rig.position.set(flight.x, flight.y + 4, flight.z);
  rig.rotation.x = flight.pitch;
  cockpit.update(flight);
  hud.textContent = flight.hudText();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

addEventListener("resize", () => {
  setFov();
  renderer.setSize(innerWidth, innerHeight);
});
