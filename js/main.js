// Final Approach - main.js
const VERSION = "0.4.0";
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

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  flight.step(dt);
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
