// Final Approach - flight.js (v0.2.0)
// Point-mass flight model in the vertical plane, landing configuration.
const G = 9.81, RHO = 1.225;
const AC = {
  mass: 60000,      // kg (airliner at landing weight)
  S: 122,           // wing area, m2
  CL0: 1.0,         // lift at zero alpha (flaps down)
  CLa: 5.0,         // lift per radian of alpha
  CD0: 0.10,        // parasitic drag (flaps + gear)
  k: 0.048,         // induced drag factor
  maxThrust: 240000 // N, both engines
};

class Flight {
  constructor() { this.reset(); }

  reset() {
    const g0 = -3 * Math.PI / 180;
    this.x = 0;
    this.z = 5700;
    this.y = this.z * Math.tan(-g0);
    this.V = 70;        // true airspeed, m/s
    this.gamma = g0;    // flight path angle, rad
    // Trim: find pitch and throttle that hold this path and speed
    const q = 0.5 * RHO * this.V * this.V;
    const CL = AC.mass * G * Math.cos(g0) / (q * AC.S);
    this.alpha = (CL - AC.CL0) / AC.CLa;
    this.pitch = g0 + this.alpha;
    const CD = AC.CD0 + AC.k * CL * CL;
    const D = q * AC.S * CD;
    const T = (D + AC.mass * G * Math.sin(g0)) / Math.cos(this.alpha);
    this.throttle = T / AC.maxThrust;
  }

  step(dt) {
    const q = 0.5 * RHO * this.V * this.V;
    this.alpha = this.pitch - this.gamma;
    const CL = AC.CL0 + AC.CLa * this.alpha;
    const CD = AC.CD0 + AC.k * CL * CL;
    const L = q * AC.S * CL;
    const D = q * AC.S * CD;
    const T = this.throttle * AC.maxThrust;
    const m = AC.mass;

    const dV = (T * Math.cos(this.alpha) - D) / m - G * Math.sin(this.gamma);
    const dGamma = (L + T * Math.sin(this.alpha) - m * G * Math.cos(this.gamma)) / (m * this.V);
    this.V += dV * dt;
    this.gamma += dGamma * dt;

    this.z -= this.V * Math.cos(this.gamma) * dt; // flying toward -z
    this.y += this.V * Math.sin(this.gamma) * dt;
  }

  hudText() {
    const kt = this.V * 1.944;
    const ft = this.y * 3.281;
    const vs = this.V * Math.sin(this.gamma) * 196.85;
    const deg = 180 / Math.PI;
    return "SPD " + kt.toFixed(0) + " kt\n" +
           "ALT " + ft.toFixed(0) + " ft\n" +
           "V/S " + vs.toFixed(0) + " fpm\n" +
           "THR " + (this.throttle * 100).toFixed(0) + " %\n" +
           "PIT " + (this.pitch * deg).toFixed(1) + " deg";
  }
}
