import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('trade preview claim is atomic and daily count is per attempt', async()=>{
  const dir=await mkdtemp(join(tmpdir(),'wallgold-claim-'));
  process.env.DATA_DIR=dir;
  const { JsonStore }=await import('../src/storage/json-store.js');
  const store=new JsonStore();
  const entry={type:'trade_attempt',at:new Date().toISOString(),clientId:'c1',notionalToman:100};
  const [a,b]=await Promise.all([
    store.claimTradeAttempt(entry,{maxDailyTrades:1,maxDailyNotionalToman:1000}),
    store.claimTradeAttempt(entry,{maxDailyTrades:1,maxDailyNotionalToman:1000}),
  ]);
  assert.equal([a.claimed,b.claimed].filter(Boolean).length,1);
  const c=await store.claimTradeAttempt({...entry,clientId:'c2'},{maxDailyTrades:1,maxDailyNotionalToman:1000});
  assert.equal(c.claimed,false);
  await rm(dir,{recursive:true,force:true});
});
