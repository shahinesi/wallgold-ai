import test from 'node:test';
import assert from 'node:assert/strict';
import { portfolioFromBalances, validateInstantMarketOrder } from '../src/domain/portfolio.js';

test('locked balance is excluded from trading capacity but included in total assets',()=>{
  const p=portfolioFromBalances([
    {currency:'TMN',amount:'1000000',locked_amount:'250000'},
    {currency:'GLD_18C_750',amount:'2.500',locked_amount:'0.400'},
  ],10_000_000);
  assert.equal(p.cashToman,1_000_000);
  assert.equal(p.availableCashToman,750_000);
  assert.equal(p.lockedCashToman,250_000);
  assert.equal(p.goldGrams,2.5);
  assert.equal(p.availableGoldGrams,2.1);
  assert.equal(p.lockedGoldGrams,0.4);
});

test('live instant market constraints block invalid order',()=>{
  const market={
    symbol:'GLD_18C_750TMN',minQty:'0.010',maxQty:'5.000',minNotional:'100000',maxNotional:'50000000',IsEnableBuySide:true,buyStatus:'enable',
  };
  assert.equal(validateInstantMarketOrder(market,'buy',0.005,50_000).allowed,false);
  assert.equal(validateInstantMarketOrder(market,'buy',1,10_000_000).allowed,true);
});

test('disabled side blocks execution regardless of numeric limits',()=>{
  const market={symbol:'GLD_18C_750TMN',IsEnableSellSide:false,minQty:'0.001',maxQty:'100'};
  const r=validateInstantMarketOrder(market,'sell',1,10_000_000);
  assert.equal(r.allowed,false);
  assert.match(r.errors.join(' '),/فروش/);
});
