export type InputMode = 'mouse' | 'hand';
export type Block = { x: number; z: number; y: number; color: number; cooldown: number };
export const TARGET = { x: 2.25, z: .8, half: .85 };
export const LIMITS = { x: 3.45, z: 2.1 };
const ACQUIRE_RADIUS = .85;
const RETAIN_RADIUS = 1.0;

export class Game {
 state: 'practice' | 'running' | 'paused' | 'finished' = 'practice';
 mode: InputMode = 'mouse'; tracked = true; score = 0; remaining = 60; attempts = 0;
 target = { x: 0, z: .2 }; position = { x: 0, y: 2.1, z: .2 };
 blocks: Block[] = []; held: number | null = null; grip = false;
 phase: 'hover' | 'down' | 'lift' | 'carry' | 'drop' = 'hover';
 message = ''; onEvent: ((event: 'score' | 'miss') => void) | null = null;
 private action = { x: 0, z: 0 };
 private needOpen = false;
 private messageTime = 0;
 private focus: number | null = null;
 private grabbing: number | null = null;
 get aimIndex() { return this.phase === 'hover' ? this.focus : this.phase === 'down' ? this.grabbing : null; }
 get dropReady() { return this.held !== null && this.phase === 'carry' && this.nearZone(this.target); }
 constructor() { this.reset(); }
 reset() {
  this.state = 'practice'; this.score = 0; this.remaining = 60; this.attempts = 0;
  this.held = null; this.grip = false; this.needOpen = false; this.phase = 'hover';
  this.focus = null; this.grabbing = null; this.messageTime = 0;
  this.position = { x: 0, y: 2.1, z: .2 }; this.target = { x: 0, z: .2 };
  this.blocks = [
   { x: -2.4, z: -.7, y: .28, color: 0x50ead1, cooldown: 0 },
   { x: -1.9, z: 1.2, y: .28, color: 0xffb657, cooldown: 0 },
   { x: -.3, z: -1, y: .28, color: 0xad94ff, cooldown: 0 },
  ];
  this.message = '靠近方块，亮起轮廓后捏合抓取';
 }
 start() { this.reset(); this.state = 'running'; this.message = '挑战开始！靠近方块，亮起后抓取'; this.messageTime = 2; }
 pause() { if (this.state === 'running') { this.state = 'paused'; this.message = '挑战已暂停，点击继续'; } }
 resume() { if (this.state === 'paused') { this.state = 'running'; this.clearGrip(); this.message = '挑战继续'; } }
 setTarget(x: number, z: number) {
  this.target = { x: Math.max(-LIMITS.x, Math.min(LIMITS.x, x)), z: Math.max(-LIMITS.z, Math.min(LIMITS.z, z)) };
  this.updateAim();
 }
 private updateAim() {
  if (this.phase !== 'hover' || this.state === 'paused' || this.state === 'finished') return;
  const distance = (b: Block) => Math.hypot(b.x - this.target.x, b.z - this.target.z);
  let nearest: number | null = null, best = ACQUIRE_RADIUS;
  this.blocks.forEach((b, i) => { const d = distance(b); if (b.cooldown <= 0 && d < best) { nearest = i; best = d; } });
  const old = this.focus === null ? undefined : this.blocks[this.focus];
  // Keep a visible lock through small movements; deliberately moving closer to
  // another block still switches targets without requiring a full exit.
  if (old && old.cooldown <= 0 && distance(old) < RETAIN_RADIUS && (nearest === null || best + .18 >= distance(old))) return;
  this.focus = nearest;
 }
 private nearZone(p: { x: number; z: number }) {
  return Math.abs(p.x - TARGET.x) <= TARGET.half + .12 && Math.abs(p.z - TARGET.z) <= TARGET.half + .12;
 }
 private beginDrop() {
  this.phase = 'drop';
  this.action = this.nearZone(this.target) ? { x: TARGET.x, z: TARGET.z } : { ...this.target };
 }
 clearGrip() { this.grip = false; this.needOpen = true; }
 setGrip(closed: boolean) {
  if (!closed) this.needOpen = false;
  if (this.state === 'paused' || this.state === 'finished' || (closed && this.needOpen)) return;
  const old = this.grip; this.grip = closed;
  if (closed && !old && this.phase === 'hover') {
   this.updateAim(); this.grabbing = this.focus;
   const block = this.grabbing === null ? null : this.blocks[this.grabbing];
   // Commit the highlighted block, not the lagging animated claw position.
   this.action = block ? { x: block.x, z: block.z } : { ...this.target };
   this.phase = 'down'; this.attempts++;
  }
  if (!closed && this.phase === 'carry') this.beginDrop();
 }
 update(dt: number) {
  if (this.state === 'paused' || this.state === 'finished') return;
  if (this.state === 'running') {
   this.remaining = Math.max(0, this.remaining - dt);
   if (this.remaining === 0) { this.state = 'finished'; this.grip = false; this.message = '挑战完成'; return; }
  }
  dt = Math.min(dt, .05);
  if (this.mode === 'hand' && !this.tracked) return;
  this.messageTime = Math.max(0, this.messageTime - dt);
  this.blocks.forEach((block, index) => {
   if (block.cooldown > 0) {
    block.cooldown -= dt;
    if (block.cooldown <= 0) { const spawn = [[-2.4, -.7], [-1.9, 1.2], [-.3, -1]][index]!; block.x = spawn[0]!; block.z = spawn[1]!; block.y = .28; }
   }
  });
  this.updateAim();
  const moving = this.phase === 'hover' || this.phase === 'carry';
  const focused = this.focus === null ? null : this.blocks[this.focus];
  const destination = this.phase === 'hover' && focused ? focused : this.dropReady ? TARGET : moving ? this.target : this.action;
  const a = 1 - Math.exp(-dt * 12);
  this.position.x += (destination.x - this.position.x) * a;
  this.position.z += (destination.z - this.position.z) * a;
  const low = this.phase === 'down' || this.phase === 'drop';
  this.position.y += ((low ? .72 : 2.1) - this.position.y) * (1 - Math.exp(-dt * 10));
  if (this.held !== null) { const b = this.blocks[this.held]!; b.x = this.position.x; b.z = this.position.z; b.y = this.position.y - .44; }
  const aligned = Math.hypot(this.position.x - this.action.x, this.position.z - this.action.z) < .1;
  if (this.phase === 'down' && this.position.y < .77 && aligned) {
   const block = this.grabbing === null ? null : this.blocks[this.grabbing];
   if (block && block.cooldown <= 0 && Math.hypot(block.x - this.position.x, block.z - this.position.z) < .2) {
    this.held = this.grabbing; this.message = '抓住了！保持捏合，移向投放区';
   } else { this.message = '先靠近方块，看到「可以抓取」再捏合'; this.onEvent?.('miss'); }
   this.messageTime = 2; this.phase = 'lift'; this.focus = null; this.grabbing = null;
  }
  if (this.phase === 'lift' && this.position.y > 2.04) { this.phase = this.held === null ? 'hover' : 'carry'; if (this.phase === 'carry' && !this.grip) this.beginDrop(); }
  if (this.phase === 'drop' && this.position.y < .77 && aligned) {
   if (this.held !== null) {
    const b = this.blocks[this.held]!; b.y = .28;
    const good = Math.abs(b.x - TARGET.x) <= TARGET.half - .27 && Math.abs(b.z - TARGET.z) <= TARGET.half - .27;
    if (good) { this.score += 10; b.cooldown = .8; this.message = '+10！准确投放'; this.onEvent?.('score'); }
    else { this.message = '已放回桌面，靠近投放区后再松开'; this.onEvent?.('miss'); }
    this.messageTime = 2; this.held = null;
   }
   this.phase = 'lift';
  }
  if (this.dropReady) this.message = '已对准投放区 · 松开即可放置';
  else if (this.aimIndex !== null && this.phase === 'hover') this.message = this.mode === 'hand' ? '可以抓取 · 捏合拇指和食指' : '可以抓取 · 按住左键';
  else if (!this.messageTime && moving) this.message = this.held !== null ? '保持捏合搬运 → 靠近发光区域后松开' : '靠近方块，亮起轮廓后抓取';
 }
}
