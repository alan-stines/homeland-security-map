'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createFeedService,normalizeNws,normalizeUsgs,normalizeFema,regionFor}=require('../feeds.cjs');
const now=Date.parse('2026-10-23T12:00:00Z');
const polygon={type:'Polygon',coordinates:[[[-85,33],[-84,33],[-84,34],[-85,33]]]};
const nws=(props={},geometry=polygon)=>({type:'FeatureCollection',features:[{geometry,properties:{id:'urn:alert:1','@id':'https://api.weather.gov/alerts/1',event:'Flood Warning',areaDesc:'Test County',status:'Actual',messageType:'Alert',severity:'Severe',sent:new Date(now-60000).toISOString(),expires:new Date(now+3600000).toISOString(),description:'Official description',...props}}]});
const quake=(lon=-84,lat=33)=>({features:[{id:'q1',geometry:{type:'Point',coordinates:[lon,lat,8]},properties:{type:'earthquake',mag:4.6,time:now-60000,updated:now,place:'Test location',url:'https://earthquake.usgs.gov/earthquakes/eventpage/q1'}}]});
const fema=()=>({DisasterDeclarationsSummaries:[{disasterNumber:123,declarationTitle:'TEST DISASTER',state:'GA',incidentType:'Flood',declarationType:'DR',declarationDate:new Date(now-86400000).toISOString()}]});
const json=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
function upstream(url){if(url.includes('weather.gov'))return nws();if(url.includes('usgs.gov'))return quake();return fema();}
test('NWS retains actual unexpired alerts and official links',()=>{
 const [e]=normalizeNws(nws(),now);assert.equal(e.source,'nws');assert.equal(e.location.region,'conus');assert.equal(e.url,'https://api.weather.gov/alerts/1');
 for(const props of [{status:'Test'},{status:'Exercise'},{messageType:'Cancel'},{expires:new Date(now-1).toISOString()},{expires:'invalid'}])assert.equal(normalizeNws(nws(props),now).length,0);
});
test('NWS uses message expiry even when the underlying incident ends later',()=>assert.equal(normalizeNws(nws({expires:new Date(now-1).toISOString(),ends:new Date(now+86400000).toISOString()}),now).length,0));
test('NWS missing geometry stays unlocated and unsafe links are discarded',()=>{
 const [e]=normalizeNws(nws({'@id':'javascript:alert(1)'},null),now);assert.equal(e.location,null);assert.equal(e.geometry,null);assert.equal(e.url,null);
});
test('US regions include AK, HI, territories and exclude distant earthquakes',()=>{
 for(const [lon,lat,id] of [[-150,64,'alaska'],[175,52,'aleutians'],[-157,21,'hawaii'],[-66,18,'caribbean'],[145,14,'pacific'],[-170,-14,'samoa']])assert.equal(regionFor(lon,lat).id,id);
 assert.equal(normalizeUsgs(quake(139,36)).length,0);assert.equal(normalizeUsgs(quake()).length,1);
});
test('USGS retains revision time, display window and preliminary guidance',()=>{
 const [e]=normalizeUsgs(quake());assert.equal(e.updated,new Date(now).toISOString());assert.equal(Date.parse(e.expires),now-60000+86400000);assert.match(e.description,/preliminary/);assert.equal(e.severity,'Moderate');
});
test('FEMA deduplicates designated-area records and excludes old declarations',()=>{
 const data=fema();data.DisasterDeclarationsSummaries.push({...data.DisasterDeclarationsSummaries[0],designatedArea:'Another county'},{...data.DisasterDeclarationsSummaries[0],disasterNumber:1,declarationDate:'2020-01-01'});
 const events=normalizeFema(data,now);assert.equal(events.length,1);assert.equal(events[0].severity,'Context');assert.equal(events[0].location,null);
});
test('invalid feed schemas fail instead of appearing as healthy empty feeds',()=>{
 for(const normalize of [normalizeNws,normalizeUsgs,normalizeFema])assert.throws(()=>normalize({}));
});
test('cache coalesces requests, observes polling intervals, and survives outages',async()=>{
 let time=now,calls=0,fail=false;
 const service=createFeedService({clock:()=>time,fetchImpl:async url=>{calls++;if(fail)throw new Error('offline');return json(upstream(url));}});
 await Promise.all([service.refreshAll(),service.refreshAll()]);assert.equal(calls,3);assert.equal(service.snapshot().events.length,3);
 await service.refreshAll();assert.equal(calls,3);
 time+=120000;fail=true;await service.refreshAll();
 const s=service.snapshot();assert.equal(s.events.length,3);assert.equal(s.sources.find(s=>s.id==='nws').status,'stale');assert.equal(s.sources.find(s=>s.id==='nws').lastSuccess,new Date(now).toISOString());
 time+=3700000;assert.equal(service.snapshot().events.filter(e=>e.source==='nws').length,0);
 fail=false;await service.refreshAll();assert.equal(service.snapshot().sources.every(s=>s.status==='ok'),true);
});
test('unavailable sources are distinguishable from successful empty sources',async()=>{
 const unavailable=createFeedService({clock:()=>now,fetchImpl:async()=>{throw new Error('blocked');}});await unavailable.refreshAll();assert.ok(unavailable.snapshot().sources.every(s=>s.status==='unavailable'));assert.deepEqual(unavailable.snapshot().events,[]);
 const empty=createFeedService({clock:()=>now,fetchImpl:async url=>json(url.includes('fema.gov')?{DisasterDeclarationsSummaries:[]}:{features:[]})});await empty.refreshAll();assert.ok(empty.snapshot().sources.every(s=>s.status==='ok'));
});
test('NWS resolves forecast-zone boundaries and never invents coordinates',async()=>{
 const service=createFeedService({clock:()=>now,fetchImpl:async url=>{
  if(url.includes('/zones/'))return json({geometry:polygon});
  if(url.includes('weather.gov'))return json(nws({affectedZones:['https://api.weather.gov/zones/forecast/GAZ001']},null));
  return json(upstream(url));
 }});await service.refreshAll();const e=service.snapshot().events.find(e=>e.source==='nws');assert.equal(e.zoneDerived,true);assert.equal(e.geometry.type,'MultiPolygon');assert.equal(e.location.region,'conus');assert.equal('zoneUrls' in e,false);
});
test('partial zone lookup failure leaves the alert unlocated',async()=>{
 const service=createFeedService({clock:()=>now,fetchImpl:async url=>{
  if(url.endsWith('GAZ002'))throw new Error('zone unavailable');
  if(url.includes('/zones/'))return json({geometry:polygon});
  if(url.includes('weather.gov'))return json(nws({affectedZones:['https://api.weather.gov/zones/forecast/GAZ001','https://api.weather.gov/zones/forecast/GAZ002']},null));
  return json(upstream(url));
 }});await service.refreshAll();const e=service.snapshot().events.find(e=>e.source==='nws');assert.equal(e.location,null);assert.equal(service.snapshot().sources[0].status,'ok');
});
test('FEMA fetches all pages before deduplication',async()=>{
 let pages=0;
 const service=createFeedService({clock:()=>now,fetchImpl:async url=>{
  if(!url.includes('fema.gov'))return json(upstream(url));pages++;
  return json(pages===1?{DisasterDeclarationsSummaries:Array.from({length:1000},()=>fema().DisasterDeclarationsSummaries[0])}:{DisasterDeclarationsSummaries:[{...fema().DisasterDeclarationsSummaries[0],disasterNumber:124}]});
 }});await service.refreshAll();assert.equal(pages,2);assert.equal(service.snapshot().events.filter(e=>e.source==='fema').length,2);
});
test('source-specific request headers support NWS identification and USGS CDN',async()=>{
 const requests=[];const service=createFeedService({clock:()=>now,fetchImpl:async(url,options)=>{requests.push({url,options});return json(upstream(url));}});
 await service.refreshAll();assert.match(requests.find(r=>r.url.includes('weather.gov')).options.headers['User-Agent'],/USSituationMap/);
 assert.equal(requests.find(r=>r.url.includes('usgs.gov')).options.headers['User-Agent'],undefined);
});
