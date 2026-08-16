import test from 'node:test'; import assert from 'node:assert/strict'; import { backtest } from '../src/domain/backtest.js';
test('بک‌تست پایه',()=>{const r=backtest([{time:'1',price:100,signalScore:50},{time:'2',price:120,signalScore:-50}],1000);assert.equal(r.returnPct,20);assert.equal(r.completedTrades,1)});
