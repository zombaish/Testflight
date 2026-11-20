// Final Approach - cockpit.js (v0.3.0)
// 3D cockpit, built in metres. Origin = pilot's eyes, -z forward, +x right, +y up.
class Cockpit {
  constructor() {
    this.group = new THREE.Group();
    this.frame = 0;

    const dark = new THREE.MeshLambertMaterial({ color: 0x1b1d21 });
    const mid = new THREE.MeshLambertMaterial({ color: 0x2c2f35 });
    const trim = new THREE.MeshLambertMaterial({ color: 0x0d0e10 });

    const box = (parent, w, h, d, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };

    // Glareshield (overhangs the top of the instrument panel)
    box(this.group, 2.5, 0.05, 0.5, trim, 0, -0.21, -1.0).rotation.x = 0.1;
    // Window pillars (lean inward at the top) and roof header
    box(this.group, 0.09, 1.1, 0.09, mid, -0.95, 0.25, -1.0).rotation.z = -0.15;
    box(this.group, 0.09, 1.1, 0.09, mid, 0.95, 0.25, -1.0).rotation.z = 0.15;
    box(this.group, 2.6, 0.25, 0.15, mid, 0, 0.62, -0.9);
    // Lower cover so there are no gaps below the panel
    box(this.group, 3, 0.1, 1.4, trim, 0, -0.9, -0.3);

    // Instrument panel, tilted toward the pilot's eyes
    const panel = new THREE.Group();
    panel.position.set(0, -0.5, -0.85);
    panel.rotation.x = -0.3;
    this.group.add(panel);
    box(panel, 2.4, 0.52, 0.04, dark, 0, 0, 0);

    const screen = (w, h, x, y, mat) => {
      box(panel, w + 0.02, h + 0.02, 0.01, trim, x, y, 0.023); // bezel
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      s.position.set(x, y, 0.029);
      panel.add(s);
    };

    // Primary flight display (live canvas texture)
    this.cv = document.createElement("canvas");
    this.cv.width = this.cv.height = 512;
    this.ctx = this.cv.getContext("2d");
    this.tex = new THREE.CanvasTexture(this.cv);
    const off = new THREE.MeshBasicMaterial({ color: 0x06090d });

    screen(0.22, 0.22, 0, 0, new THREE.MeshBasicMaterial({ map: this.tex })); // PFD
    screen(0.22, 0.22, 0.25, 0, off);     // navigation display (blank for now)
    screen(0.2, 0.15, 0.5, 0.1, off);     // upper ECAM (blank)
    screen(0.2, 0.15, 0.5, -0.1, off);    // lower ECAM (blank)
    screen(0.22, 0.22, 0.75, 0, off);     // first officer ND
    screen(0.22, 0.22, 1.0, 0, off);      // first officer PFD

    this.drawPFD({ pitch: 0, V: 70, y: 300, gamma: 0 });
    this.tex.needsUpdate = true;
  }

  update(f) {
    this.frame++;
    if (this.frame % 3) return; // redraw the screen 20 times a second
    this.drawPFD(f);
    this.tex.needsUpdate = true;
  }

  drawPFD(f) {
    const c = this.ctx, cx = 256, cy = 256, ppd = 7; // ppd = pixels per degree
    const pitch = f.pitch * 180 / Math.PI;
    const kt = f.V * 1.944, ft = f.y * 3.281;
    const vs = f.V * Math.sin(f.gamma) * 196.85;

    c.fillStyle = "#000";
    c.fillRect(0, 0, 512, 512);

    // Artificial horizon
    c.save();
    c.beginPath(); c.rect(84, 30, 344, 452); c.clip();
    c.translate(cx, cy);
    const hy = pitch * ppd;
    c.fillStyle = "#2f6fd0"; c.fillRect(-300, -900 + hy, 600, 900);
    c.fillStyle = "#7b5530"; c.fillRect(-300, hy, 600, 900);
    c.strokeStyle = "#fff"; c.fillStyle = "#fff"; c.lineWidth = 3;
    c.font = "bold 18px monospace"; c.textAlign = "center";
    for (let d = -20; d <= 20; d += 2.5) {
      const y = hy - d * ppd;
      const w = d === 0 ? 300 : d % 10 === 0 ? 70 : d % 5 === 0 ? 40 : 20;
      c.beginPath(); c.moveTo(-w, y); c.lineTo(w, y); c.stroke();
      if (d && d % 10 === 0) {
        c.fillText(Math.abs(d), -w - 20, y + 6);
        c.fillText(Math.abs(d), w + 20, y + 6);
      }
    }
    c.restore();

    // Aircraft reference symbol
    c.strokeStyle = "#ffd400"; c.lineWidth = 5;
    c.beginPath();
    c.moveTo(cx - 70, cy); c.lineTo(cx - 25, cy); c.lineTo(cx - 25, cy + 12);
    c.moveTo(cx + 70, cy); c.lineTo(cx + 25, cy); c.lineTo(cx + 25, cy + 12);
    c.stroke();
    c.fillStyle = "#ffd400"; c.fillRect(cx - 4, cy - 4, 8, 8);

    // Speed tape (left)
    c.fillStyle = "rgba(20,22,26,0.92)"; c.fillRect(0, 30, 84, 452);
    c.save();
    c.beginPath(); c.rect(0, 30, 84, 452); c.clip();
    c.fillStyle = "#fff"; c.font = "18px monospace"; c.textAlign = "right";
    for (let v = Math.floor(kt / 10) * 10 - 70; v <= kt + 70; v += 10) {
      if (v < 30) continue;
      const y = cy - (v - kt) * 3;
      c.fillRect(70, y - 1, 14, 2);
      if (v % 20 === 0) c.fillText(v, 64, y + 6);
    }
    c.restore();
    c.fillStyle = "#000"; c.fillRect(0, cy - 20, 84, 40);
    c.strokeStyle = "#ffd400"; c.lineWidth = 2; c.strokeRect(1, cy - 20, 82, 40);
    c.fillStyle = "#0f0"; c.font = "bold 28px monospace"; c.textAlign = "center";
    c.fillText(Math.round(kt), 42, cy + 10);

    // Altitude tape (right)
    c.fillStyle = "rgba(20,22,26,0.92)"; c.fillRect(428, 30, 84, 452);
    c.save();
    c.beginPath(); c.rect(428, 30, 84, 452); c.clip();
    c.fillStyle = "#fff"; c.font = "18px monospace"; c.textAlign = "left";
    for (let a = Math.floor(ft / 100) * 100 - 300; a <= ft + 300; a += 100) {
      if (a < 0) continue;
      const y = cy - (a - ft) * 0.6;
      c.fillRect(428, y - 1, 14, 2);
      c.fillText(a, 446, y + 6);
    }
    c.restore();
    c.fillStyle = "#000"; c.fillRect(428, cy - 20, 84, 40);
    c.strokeStyle = "#ffd400"; c.lineWidth = 2; c.strokeRect(429, cy - 20, 82, 40);
    c.fillStyle = "#0f0"; c.font = "bold 28px monospace"; c.textAlign = "center";
    c.fillText(Math.round(ft / 10) * 10, 470, cy + 10);

    // Vertical speed
    c.fillStyle = "#0f0"; c.font = "20px monospace"; c.textAlign = "center";
    c.fillText("V/S " + Math.round(vs / 50) * 50, cx, 502);
  }
}
