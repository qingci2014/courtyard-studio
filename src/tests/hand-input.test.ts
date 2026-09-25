import { afterEach, describe, expect, it, vi } from 'vitest';
import { HandInput } from '../hand-input';

afterEach(() => vi.unstubAllGlobals());

describe('camera tracking gaps', () => {
 it('keeps the last command through brief missed landmarks and freezes after sustained loss', () => {
  vi.stubGlobal('document', { hidden: false });
  vi.stubGlobal('requestAnimationFrame', () => 1);
  const video = { readyState: 2, currentTime: 0, videoWidth: 640, videoHeight: 480 };
  const canvas = { width: 640, height: 480, getContext: () => ({ clearRect: () => undefined }) };
  const frame = vi.fn(), lost = vi.fn();
  const input = new HandInput(video as unknown as HTMLVideoElement, canvas as unknown as HTMLCanvasElement,
   { status: () => undefined, frame, lost, ended: () => undefined });
  const internals = input as unknown as { active: boolean; lastSeen: number;
   model: { detectForVideo: () => { landmarks: [] } }; loop: (now: number) => void };
  internals.active = true; internals.lastSeen = 100;
  internals.model = { detectForVideo: () => ({ landmarks: [] }) };
  video.currentTime = 1; internals.loop(200);
  video.currentTime = 2; internals.loop(500);
  expect(frame).not.toHaveBeenCalled(); expect(lost).not.toHaveBeenCalled();
  video.currentTime = 3; internals.loop(850);
  expect(frame).toHaveBeenCalledOnce(); expect(frame).toHaveBeenCalledWith(null);
  expect(lost).toHaveBeenCalledOnce();
 });
});
