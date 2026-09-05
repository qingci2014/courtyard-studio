/** Palm stabilisation and asymmetric pinch debounce, independent of camera APIs. */
export class GestureFilter {
 private position: { x: number; z: number } | null = null;
 private previous = 0;
 private pinched = false;
 private candidate = false;
 private since = 0;
 private lockUntil = 0;
 reset() { this.position = null; this.previous = 0; this.pinched = false; this.candidate = false; this.since = 0; this.lockUntil = 0; }
 suspend() { this.position = null; this.previous = 0; this.candidate = this.pinched; this.since = 0; this.lockUntil = 0; }
 update(x: number, z: number, ratio: number, now: number) {
  const dt = this.previous ? Math.max(.001, Math.min(.15, (now - this.previous) / 1000)) : .065;
  this.previous = now;
  this.position ??= { x, z };
  const candidate = this.pinched ? ratio < .66 : ratio < .38;
  if (candidate !== this.candidate) { this.candidate = candidate; this.since = now; }
  const changing = this.candidate !== this.pinched;
  // Opening gets a longer confirmation so one noisy frame cannot drop a block.
  if (changing && now - this.since >= (this.candidate ? 80 : 200)) {
   this.pinched = this.candidate;
   this.lockUntil = now + 120;
  }
  if (!changing && now >= this.lockUntil) {
   const distance = Math.hypot(x - this.position.x, z - this.position.z);
   const speed = distance / dt;
   const alpha = 1 - Math.exp(-dt * Math.min(30, 10 + speed * 1.8));
   if (distance > .018) { this.position.x += (x - this.position.x) * alpha; this.position.z += (z - this.position.z) * alpha; }
  }
  return { ...this.position, pinch: this.pinched };
 }
}
