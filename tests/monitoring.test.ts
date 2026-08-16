import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateWatchRules } from '../src/domain/monitoring.js';

test('watch rules trigger deterministically',()=>{
  const r=evaluateWatchRules([
    {id:'1',name:'price',kind:'price_below',threshold:100,enabled:true},
    {id:'2',name:'score',kind:'signal_score_above',threshold:30,enabled:true},
  ],{priceToman:90,signalScore:45});
  assert.equal(r.filter(x=>x.matched).length,2);
});
