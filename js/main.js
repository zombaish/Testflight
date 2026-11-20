// Final Approach - main.js
const VERSION = "0.4.3";
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
  }
};
el.addEventListener("pointerup", endDrag);
el.addEventListener("pointercancel", endDrag);

const keys = {};
addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (k === "c") { lookYaw = 0; lookPitch = 0; }
  keys[k] = true;
  if (k.startsWith("arrow")) e.preventDefault();
});
addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

function updateLook(dt) {
  const r = 1.6 * dt; // keyboard turn speed, radians per second
  if (keys.arrowleft || keys.a) lookYaw += r;
  if (keys.arrowright || keys.d) lookYaw -= r;
  if (keys.arrowup || keys.w) lookPitch += r;
  if (keys.arrowdown || keys.s) lookPitch -= r;
  clampLook();
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
