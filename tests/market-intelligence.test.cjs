const test=require('node:test');
const assert=require('node:assert/strict');
const Market=require('../js/core/market-intelligence.js');

const now=new Date('2026-11-07T12:00:00Z');
const obs=(group,signal,hours=1)=>({id:group,label:group,value:1,group,signal,cadence:'daily',observedAt:new Date(now-hours*36e5).toISOString(),source:'Official'});

test('normalizes market observations and flags stale data by cadence',()=>{
 const out=Market.normalize({observations:[obs('bond',0,2),obs('global',0,100)]},now);
 assert.equal(out.observations[0].stale,false);
 assert.equal(out.observations[1].stale,true);
});

test('insufficient evidence never produces an execution batch',()=>{
 const out=Market.assess({observations:[obs('bond',1)]},now);
 assert.equal(out.regime,'insufficient');
 assert.equal(out.overlay.batches,0);
 assert.equal(out.overlay.reviewRequired,true);
});

test('risk evidence changes execution pace rather than target allocation',()=>{
 const input={observations:[obs('global',-.8),obs('equity',-.7),obs('bond',-.6),obs('futures',-.5)]};
 const targets={liquid:20,fixed:30,investment:50,other:0};
 const out=Market.assess(input,now);
 assert.equal(out.regime,'defensive');
 assert.equal(out.overlay.batches,4);
 assert.deepEqual(targets,{liquid:20,fixed:30,investment:50,other:0});
});

test('monthly evidence is not treated as stale after a few days',()=>{
 const row=obs('global',0,120);row.cadence='monthly';
 assert.equal(Market.normalize({observations:[row]},now).observations[0].stale,false);
});
