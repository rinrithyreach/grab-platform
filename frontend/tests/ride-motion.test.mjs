import assert from "node:assert/strict";
import test from "node:test";
import { loadLib } from "./load-lib.mjs";

const { createRideMotion, motionPath, remainingPath, continuousHeading, metresBetween } = await loadLib("ride-motion");

function animation() {
  let time = 0, id = 0;
  const frames = new Map(), values = [];
  const motion = createRideMotion({ now: () => time, requestFrame(callback) { frames.set(++id, callback); return id; },
    cancelFrame: (frame) => frames.delete(frame), onFrame: (point, heading) => values.push({ point, heading }) });
  return { motion, frames, values, advance(ms) {
    time += ms;
    const callbacks = [...frames.values()]; frames.clear();
    callbacks.forEach((callback) => callback(time));
  } };
}

test("live motion follows road bends at a steady distance, turns the car and stops at the exact GPS fix", () => {
  const app = animation();
  const from = [11.55, 104.92], corner = [11.55, 104.921], to = [11.551, 104.921];
  app.motion.moveTo(from, { timestamp: 1000 });
  assert.deepEqual(app.values.at(-1).point, from);
  app.advance(3000);
  app.motion.moveTo(to, { timestamp: 4000, road: [from, corner, to] });
  app.advance(550);
  const early = app.values.at(-1);
  assert.ok(Math.abs(early.point[0] - from[0]) < 0.00001, "The car stays on the first road, not diagonally through the block");
  assert.ok(early.point[1] > from[1] && early.point[1] < corner[1]);
  assert.ok(early.heading > 80 && early.heading < 100);
  app.advance(1100);
  const late = app.values.at(-1);
  assert.ok(Math.abs(late.point[1] - to[1]) < 0.00001);
  assert.ok(late.point[0] > from[0] && late.point[0] < to[0]);
  assert.ok(Math.abs(late.heading) < 1);
  app.advance(550);
  assert.deepEqual(app.values.at(-1).point, to);
  assert.equal(app.frames.size, 0, "No animation continues beyond the most recent observation");
});

test("fresh heartbeats do not restart movement, old fixes are ignored and new fixes retarget from the displayed position", () => {
  const app = animation();
  app.motion.moveTo([11.55, 104.92], { timestamp: 1000 });
  app.advance(3000);
  app.motion.moveTo([11.55, 104.921], { timestamp: 4000 });
  app.advance(550);
  const displayed = app.values.at(-1).point;
  const pending = [...app.frames.keys()];
  app.motion.moveTo([11.55, 104.921], { timestamp: 5000 });
  assert.deepEqual([...app.frames.keys()], pending);
  app.motion.moveTo([11.55, 104.919], { timestamp: 2000 });
  assert.deepEqual([...app.frames.keys()], pending);
  app.motion.moveTo([11.55, 104.922], { timestamp: 6000 });
  assert.deepEqual(app.values.at(-1).point, displayed, "Retargeting does not jump back to the previous raw fix");
  assert.equal(app.frames.size, 1);
  app.advance(2200);
  assert.deepEqual(app.values.at(-1).point, [11.55, 104.922]);
  assert.equal(app.frames.size, 0);
});

test("reduced motion, backgrounding, GPS jumps and unmount cleanup leave no runaway animation", () => {
  const app = animation();
  app.motion.moveTo([11.55, 104.92], { timestamp: 1000 });
  app.motion.moveTo([11.55, 104.921], { timestamp: 2000, immediate: true });
  assert.deepEqual(app.values.at(-1).point, [11.55, 104.921]);
  assert.equal(app.frames.size, 0);
  app.motion.moveTo([12.55, 104.92], { timestamp: 3000 });
  assert.equal(app.frames.size, 0, "A kilometre-scale jump is not animated across the city");
  app.motion.moveTo([12.55, 104.921], { timestamp: 4000 });
  app.motion.finish();
  assert.equal(app.frames.size, 0);
  assert.deepEqual(app.values.at(-1).point, [12.55, 104.921]);
  app.motion.moveTo([12.55, 104.922], { timestamp: 5000 });
  app.motion.stop();
  const count = app.values.length;
  app.advance(10000);
  assert.equal(app.values.length, count);
});

test("heading wraps naturally, off-road fixes remain honest and completed road sections are trimmed", () => {
  assert.equal(continuousHeading(359, 1), 361);
  assert.equal(continuousHeading(1, 359), -1);
  const road = [[11.55, 104.92], [11.55, 104.921], [11.551, 104.921]];
  assert.deepEqual(motionPath([11.56, 104.92], [11.561, 104.921], road), [[11.56, 104.92], [11.561, 104.921]]);
  const remaining = remainingPath([11.5505, 104.921], road);
  assert.deepEqual(remaining.at(-1), road.at(-1));
  assert.ok(remaining.every((point) => point[0] >= 11.5505));
  assert.ok(metresBetween([11.55, 104.92], [11.55, 104.921]) > 100);
});
