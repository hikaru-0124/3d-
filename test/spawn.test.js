import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SPAWNS,blocked,chooseSpawn,visibleFrom,SPAWN_PROTECTION_MS} from '../public/world.js';

test('all 22 spawn points are outside cover and inside the arena',()=>{
  assert.equal(SPAWNS.length,22);
  assert.equal(new Set(SPAWNS.map(p=>p.join(','))).size,22);
  for(const [x,z]of SPAWNS)assert.equal(blocked(x,z),false,`${x}, ${z}`);
  assert.equal(SPAWN_PROTECTION_MS,5000);
});
test('cover is preferred over an exposed point at the same distance',()=>{
  const enemy={x:-20,z:0,hp:100};
  assert.equal(visibleFrom(0,0,enemy),false);
  assert.equal(visibleFrom(-12,0,enemy),true);
  assert.deepEqual(chooseSpawn([enemy],null,[[-12,0],[-20,8]]),[-20,8]);
});
test('nearby enemies exclude a spawn even when cover blocks their shot',()=>{
  const enemy={x:-12,z:0,hp:100};
  assert.equal(visibleFrom(-5,0,enemy),false);
  assert.deepEqual(chooseSpawn([enemy],null,[[-5,0],[-20,20]]),[-20,20]);
});
test('occupied arenas fall back to maximum separation; dead players are ignored',()=>{
  const enemy={x:20,z:20,hp:100};
  assert.deepEqual(chooseSpawn([enemy],null,[[20,20],[20,18],[20,14]]),[20,14]);
  assert.deepEqual(chooseSpawn([{...enemy,hp:0}],null,[[20,20],[-20,-20]]),[20,20]);
});
test('equally safe spawns rotate away from the previous location',()=>{
  assert.deepEqual(chooseSpawn([],[-20,-20],[[-20,-20],[20,20]]),[20,20]);
  assert.deepEqual(chooseSpawn([],null,[[0,0],[20,20]]),[20,20]);
});
