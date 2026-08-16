import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRebalance } from '../src/domain/rebalance.js';

test('rebalance suggests buy below target',()=>{
  const r=calculateRebalance({cashToman:800,goldGrams:2,goldPriceToman:100,targetGoldAllocationPct:40,tolerancePct:0.1});
  assert.equal(r.action,'buy');
  assert.equal(r.estimatedTomanAmount,200);
});

test('rebalance returns no action inside tolerance',()=>{
  const r=calculateRebalance({cashToman:750,goldGrams:2.5,goldPriceToman:100,targetGoldAllocationPct:25,tolerancePct:0.1});
  assert.equal(r.action,'none');
});
