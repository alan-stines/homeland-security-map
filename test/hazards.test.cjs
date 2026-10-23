'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalizeNifc,normalizeNwps,createFeedService,definitions}=require('../feeds.cjs');
const now=Date.parse('2026-10-23T12:00:00Z');
const fire=(properties={},geometry={type:'Point',coordinates:[-84,33]})=>({geometry,properties:{IrwinID:'fire-1',IncidentName:'Test',IncidentTypeCategory:'WF',FireDiscoveryDateTime:now-86400000,ModifiedOnDateTime_dt:now-60000,FireOutDateTime:null,IncidentSize:120,PercentContained:0,POOState:'US-GA',...properties}});
const gauge=(status={},extra={})=>({lid:'TEST1',name:'Test river',longitude:-84,latitude:33,state:{abbreviation:'GA'},status:{observed:{floodCategory:'minor',primary:12,primaryUnit:'ft',validTime:new Date(now-60000).toISOString()},...status},...extra});
const json=d=>new Response(JSON.stringify(d));
function riverPage(url,items){const forecast=url.includes('/15/');return {features:items.map(g=>({geometry:{type:'Point',coordinates:[g.longitude,g.latitude]},properties:{gaugelid:g.lid,waterbody:g.name,location:'Test location',state:'GA',status:g.status[forecast?'forecast':'observed']?.floodCategory||'no_flooding',observed:'12',forecast:'15',units:'ft',obstime:g.status.observed?.validTime,fcsttime:g.status.forecast?.validTime}}))};}
function empty(url){return url.includes('fema.gov')?{DisasterDeclarationsSummaries:[]}:{features:[]};}

test('NIFC preserves reported metadata without inventing severity or a perimeter',()=>{
 const [e]=normalizeNifc({features:[fire()]});
 assert.equal(e.category,'wildfire');assert.equal(e.severity,'Reported');assert.equal(e.updated,new Date(now-60000).toISOString());assert.equal(e.geometry.type,'Point');assert.match(e.description,/120 acres/);assert.match(e.description,/0% containment/);assert.equal(e.expires,null);
 for(const p of [{IncidentTypeCategory:'RX'},{FireOutDateTime:now},{ModifiedOnDateTime_dt:null},{IrwinID:null}])assert.equal(normalizeNifc({features:[fire(p)]}).length,0);
 assert.equal(normalizeNifc({features:[fire({},null)]}).length,0);
 assert.throws(()=>normalizeNifc({error:{message:'unavailable'}}));
});

test('NOAA separates observed flooding from higher forecast category and retains valid times',()=>{
 const future=new Date(now+86400000).toISOString();
 const [e]=normalizeNwps({gauges:[gauge({forecast:{floodCategory:'major',primary:20,primaryUnit:'ft',validTime:future}})]},now);
 assert.equal(e.severity,'Severe');assert.match(e.title,/Major.*forecast/);assert.match(e.description,/Observed: minor/);assert.match(e.description,/Forecast: major/);assert.ok(e.description.includes(future));assert.equal(e.geometry.type,'Point');assert.equal(e.url,'https://water.noaa.gov/gauges/test1');
});

test('NOAA excludes non-flooding, outdated, invalid and unlocated gauges',()=>{
 for(const observed of [{floodCategory:'action',validTime:new Date(now).toISOString()},{floodCategory:'no_flooding'},{floodCategory:'major',validTime:null},{floodCategory:'major',validTime:new Date(now-25*3600000).toISOString()},{floodCategory:'major',validTime:new Date(now+3600000).toISOString()}])assert.equal(normalizeNwps({gauges:[gauge({observed})]},now).length,0);
 assert.equal(normalizeNwps({gauges:[gauge({}, {longitude:null})]},now).length,0);
 assert.equal(normalizeNwps({gauges:[gauge({observed:null,forecast:{floodCategory:'major',validTime:new Date(now-60000).toISOString()}})]},now).length,0);
 assert.throws(()=>normalizeNwps({}));
});

test('NIFC follows GeoJSON transfer limits and retains previous cache on a failed page',async()=>{
 let time=now,fail=false,pages=[];
 const service=createFeedService({wait:async()=>{},clock:()=>time,fetchImpl:async url=>{
  if(!url.includes('arcgis.com'))return json(empty(url));
  const offset=new URL(url).searchParams.get('resultOffset');pages.push(offset);
  if(offset==='0')return json({features:[fire()],properties:{exceededTransferLimit:true}});
  if(fail)throw new Error('page unavailable');
  return json({features:[fire({IrwinID:'fire-2'})]});
 }});
 await service.refreshAll();assert.deepEqual(pages,['0','1']);assert.equal(service.snapshot().events.length,2);
 time+=5*60000;fail=true;await service.refreshAll();assert.equal(service.snapshot().events.length,2);assert.equal(service.snapshot().sources.find(s=>s.id==='nifc').status,'stale');
});

test('NOAA uses the two official GIS layers and retains its cache after a failed refresh',async()=>{
 let time=now,fail=false,calls=0;
 const service=createFeedService({wait:async()=>{},clock:()=>time,fetchImpl:async url=>{
  if(!url.includes('mapservices.weather.noaa.gov'))return json(empty(url));
  assert.equal(new URL(url).searchParams.get('outSR'),'4326');calls++;
  if(fail)throw new Error('source failed');
  return json(riverPage(url,[gauge(),gauge()]));
 }});
 await service.refreshAll();assert.equal(calls,2);assert.equal(service.snapshot().events.length,1);
 await service.refreshAll();assert.equal(calls,2);
 time+=10*60000;fail=true;await service.refreshAll();assert.equal(service.snapshot().events.length,1);assert.equal(service.snapshot().sources.find(s=>s.id==='nwps').status,'stale');
 assert.equal(definitions.find(d=>d.id==='nwps').interval,600000);
});

test('NOAA honors a short Retry-After once and keeps its request header compatible',async()=>{
 const waits=[];let first=true;
 const service=createFeedService({clock:()=>now,wait:async ms=>waits.push(ms),fetchImpl:async(url,options)=>{
  if(!url.includes('mapservices.weather.noaa.gov'))return json(empty(url));
  assert.equal(options.headers['User-Agent'],undefined);
  if(first){first=false;return new Response('',{status:429,headers:{'Retry-After':'2'}});}
  return json(riverPage(url,[gauge()]));
 }});
 await service.refreshAll();assert.equal(waits[0],2000);assert.equal(waits.length,1);assert.equal(service.snapshot().sources.find(s=>s.id==='nwps').status,'ok');
});
test('NOAA cached records expire during source outages',async()=>{
 let time=now,fail=false;
 const service=createFeedService({wait:async()=>{},clock:()=>time,fetchImpl:async url=>{
  if(!url.includes('mapservices.weather.noaa.gov'))return json(empty(url));
  if(fail)throw new Error('offline');
  return json(riverPage(url,[gauge()]));
 }});
 await service.refreshAll();assert.equal(service.snapshot().events.length,1);
 time+=25*3600000;fail=true;await service.refreshAll();assert.equal(service.snapshot().events.length,0);assert.equal(service.snapshot().sources.find(s=>s.id==='nwps').status,'stale');
});
