// Final Approach - main.js
const VERSION = "0.4.7";
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

scene.add(new THREE.HemisphereLight(0xffffff, 0x446644, 1.0));

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
  lookYaw -= dx * k;   // finger moves right -> look right
  lookPitch -= dy * k; // finger moves up -> look up
  clampLook();
});
const endDrag = e => {
  if (e.pointerId !== dragId) return;
  dragId = null;
  if (moved < 10) { // it was a tap; two quick taps recentre the view
    const now = performance.now();
    if (now - lastTap < 350) { lookYaw = 0; lookPitch = 0; }
    lastTap = now;
    if (showNames) showPartName(e.clientX, e.clientY);
  }
};
el.addEventListener("pointerup", endDrag);
el.addEventListener("pointercancel", endDrag);

const keys = {};
addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (k === "c") { lookYaw = 0; lookPitch = 0; }
  if (k === "e" && !e.repeat) toggleWalk();
  keys[k] = true;
  if (k.startsWith("arrow")) e.preventDefault();
});
addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

// --- Walk mode: WALK button (or E) turns free walking on/off. Off just stops you where you are. ---
let walk = false, walkX = 0, walkZ = 0, joyX = 0, joyY = 0;
const ui = (tag, css) => {
  const d = document.createElement(tag);
  d.style.cssText = css;
  document.body.appendChild(d);
  return d;
};
const walkBtn = ui("button", "position:fixed;top:8px;right:8px;z-index:5;padding:8px 14px;font:14px monospace;color:#fff;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.5);border-radius:6px");
walkBtn.textContent = "WALK";
const stick = ui("div", "position:fixed;left:24px;bottom:24px;z-index:5;width:110px;height:110px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.35);touch-action:none;display:none");
const nub = document.createElement("div");
nub.style.cssText = "position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(255,255,255,.45);pointer-events:none";
stick.appendChild(nub);

function toggleWalk() {
  walk = !walk;
  walkBtn.textContent = walk ? "WALK: ON" : "WALK";
  stick.style.display = walk ? "block" : "none";
  if (!walk) { joyX = 0; joyY = 0; } // you stay where you are
}
walkBtn.addEventListener("click", () => { toggleWalk(); walkBtn.blur(); });

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
function showPartName(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(cockpit.group.children, true)[0];
  let o = hit && hit.object;
  while (o && !o.name) o = o.parent;
  nameLabel.textContent = o ? o.name : "";
  nameLabel.style.display = o ? "block" : "none";
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function updateLook(dt) {
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
  }
  camera.position.set(walkX, 0, walkZ);
  camera.rotation.set(lookPitch, lookYaw, 0);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  flight.step(dt);
  updateLook(dt);
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
