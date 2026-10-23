'use strict';
const regions = require('./regions.js');
const MINUTE = 60_000;
const validDate = value => value!==null && value!==undefined && value!=='' && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;
const clean = (value, max = 20000) => typeof value === 'string' ? value.slice(0,max) : '';
const regionFor = (lon,lat) => regions.find(r => lon>=r.bounds[0] && lon<=r.bounds[2] && lat>=r.bounds[1] && lat<=r.bounds[3]);
function safeLink(value, host) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === host ? url.href : null; } catch { return null; }
}
function geometryPoints(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Point') return [geometry.coordinates];
  if (geometry.type === 'Polygon') return geometry.coordinates[0] || [];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flatMap(p=>p[0] || []);
  return [];
}
function location(geometry) {
  const points = geometryPoints(geometry).filter(p=>Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0])<=180 && Math.abs(p[1])<=90);
  if (!points.length) return null;
  // A representative point is used only to assign a viewing region. Polygons draw their actual outlines.
  const point = points.find(p=>regionFor(...p));
  if (!point) return null;
  const region = regionFor(...point);
  return region ? {lon:point[0],lat:point[1],region:region.id} : null;
}
function normalizeNws(data, now = Date.now()) {
  if (!Array.isArray(data?.features)) throw new Error('Invalid NWS feature collection');
  return data.features.flatMap(f=>{
    const p=f.properties || {}, expires=validDate(p.expires), issued=validDate(p.sent);
    if (p.status!=='Actual' || p.messageType==='Cancel' || !expires || Date.parse(expires)<=now || !issued || !p.id) return [];
    const coordinates=location(f.geometry);
    return [{id:'nws:'+p.id,source:'nws',category:'weather',title:clean(p.event,200),area:clean(p.areaDesc,3000),severity:clean(p.severity,40)||'Unknown',issued,updated:issued,expires,url:safeLink(p['@id'] || p.id,'api.weather.gov'),description:clean(p.description),instruction:clean(p.instruction),geometry:coordinates ? f.geometry : null,location:coordinates,zoneUrls:Array.isArray(p.affectedZones)?p.affectedZones.filter(u=>safeLink(u,'api.weather.gov') && new URL(u).pathname.startsWith('/zones/')).slice(0,100):[]}];
  });
}
function normalizeUsgs(data) {
  if (!Array.isArray(data?.features)) throw new Error('Invalid USGS feature collection');
  return data.features.flatMap(f=>{
    const p=f.properties || {}, loc=location(f.geometry);
    if (!loc || p.type!=='earthquake' || !f.id || !Number.isFinite(p.mag) || !validDate(p.time)) return [];
    return [{id:'usgs:'+f.id,source:'usgs',category:'earthquake',title:`M ${p.mag.toFixed(1)} earthquake`,area:clean(p.place,500),severity:p.mag>=6?'Severe':p.mag>=4.5?'Moderate':'Minor',issued:validDate(p.time),updated:validDate(p.updated)||validDate(p.time),expires:new Date(p.time+24*60*MINUTE).toISOString(),url:safeLink(p.url,'earthquake.usgs.gov'),description:`Magnitude ${p.mag}. Depth ${Number(f.geometry.coordinates[2] || 0).toFixed(1)} km. ${p.status==='reviewed'?'Reviewed':'Automatic/preliminary'} USGS solution; revisions are possible.`,instruction:'Consult the official USGS event page and local authorities for impacts. Magnitude is not a local impact assessment.',location:loc,geometry:f.geometry}];
  });
}
function normalizeFema(data, now=Date.now()) {
  if (!Array.isArray(data?.DisasterDeclarationsSummaries)) throw new Error('Invalid OpenFEMA response');
  const grouped=new Map();
  for (const p of data.DisasterDeclarationsSummaries) {
    const date=validDate(p.declarationDate);
    if (!p.disasterNumber || !date || Date.parse(date)<now-90*24*60*MINUTE) continue;
    const id='fema:'+p.disasterNumber;
    if (!grouped.has(id)) grouped.set(id,{id,source:'fema',category:'declaration',title:clean(p.declarationTitle,300),area:clean(p.state,20),severity:'Context',issued:date,updated:validDate(p.lastRefresh)||date,expires:null,url:`https://www.fema.gov/disaster/${encodeURIComponent(p.disasterNumber)}`,description:`${clean(p.incidentType,100)} · ${clean(p.declarationType,30)} declaration ${p.disasterNumber}. This is an administrative declaration, not a current warning or a measure of ongoing incident severity.`,instruction:'See the official disaster page for assistance and designated areas.',location:null,geometry:null});
  }
  return [...grouped.values()];
}
function normalizeNifc(data) {
  if (!Array.isArray(data?.features) || data.error) throw new Error('Invalid NIFC feature collection');
  return data.features.flatMap(f=>{
    const p=f.properties || {}, loc=location(f.geometry);
    const updated=validDate(p.ModifiedOnDateTime_dt), issued=validDate(p.FireDiscoveryDateTime);
    if (!loc || f.geometry?.type!=='Point' || !p.IrwinID || p.IncidentTypeCategory!=='WF' || p.FireOutDateTime || !updated) return [];
    const acres=Number.isFinite(p.IncidentSize)?`${p.IncidentSize.toLocaleString('en-US')} acres reported`:'Size not reported';
    const containment=Number.isFinite(p.PercentContained)?`${p.PercentContained}% containment reported`:'Containment not reported';
    return [{id:'nifc:'+p.IrwinID,source:'nifc',category:'wildfire',title:clean(p.IncidentName,200)+' wildfire',area:clean(p.POOState,40),severity:'Reported',issued:issued||updated,updated,expires:null,url:'https://www.nifc.gov/fire-information/maps',description:`${acres}. ${containment}. Reported incident location, not a fire perimeter or evacuation boundary. Containment is not a measure of public safety.`,instruction:'Check local emergency management and official fire information for evacuation orders and current conditions.',location:loc,geometry:f.geometry}];
  });
}
function normalizeNwps(data, now=Date.now()) {
  if (!Array.isArray(data?.gauges)) throw new Error('Invalid NOAA NWPS gauge response');
  const rank={minor:1,moderate:2,major:3};
  return data.gauges.flatMap(p=>{
    const geometry={type:'Point',coordinates:[p.longitude,p.latitude]},loc=location(geometry);
    if (!loc || !p.lid) return [];
    const samples=['observed','forecast'].flatMap(kind=>{
      const s=p.status?.[kind],time=validDate(s?.validTime),category=clean(s?.floodCategory,40).toLowerCase();
      if (!rank[category] || !time || Date.parse(time)<now-24*60*MINUTE || (kind==='forecast' && Date.parse(time)<now) || (kind==='observed' && Date.parse(time)>now+5*MINUTE)) return [];
      return [{kind,category,time,value:Number.isFinite(s.primary)?`${s.primary} ${clean(s.primaryUnit,30)}`:'Level unavailable'}];
    });
    if (!samples.length) return [];
    const peak=samples.reduce((a,b)=>rank[b.category]>rank[a.category]?b:a),observed=samples.find(s=>s.kind==='observed');
    const updated=observed?.time||peak.time;
    return [{id:'nwps:'+p.lid,source:'nwps',category:'river',title:`${peak.category[0].toUpperCase()+peak.category.slice(1)} river flooding · ${peak.kind==='observed'?'observed':'forecast'}`,area:[clean(p.name,300),clean(p.state?.abbreviation,20)].filter(Boolean).join(' · '),severity:{minor:'Minor',moderate:'Moderate',major:'Severe'}[peak.category],issued:updated,updated,expires:new Date(Math.max(...samples.map(s=>Date.parse(s.time)))+24*60*MINUTE).toISOString(),url:'https://water.noaa.gov/gauges/'+encodeURIComponent(p.lid.toLowerCase()),description:samples.map(s=>`${s.kind==='observed'?'Observed':'Forecast'}: ${s.category} flooding, ${s.value}; valid ${s.time}.`).join('\n')+'\nGauge location only; this marker is not a flood extent. Only minor, moderate, or major flood categories are displayed.',instruction:'Consult the official gauge hydrograph and NWS warnings for impacts and protective actions.',location:loc,geometry}];
  });
}
const nifcUrl='https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query';
const riverBase='https://mapservices.weather.noaa.gov/eventdriven/rest/services/water/riv_gauges/MapServer';
const riverUrl=(layer,offset=0)=>riverBase+'/'+layer+'/query?'+new URLSearchParams({where:"status IN ('minor','moderate','major')",outFields:'*',outSR:'4326',f:'geojson',orderByFields:'objectid ASC',resultRecordCount:'2000',resultOffset:String(offset)});
const riverTime=value=>typeof value==='string' && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)?value.replace(' ','T')+'Z':value;
const definitions = [
  {id:'nifc',name:'NIFC Wildfire Incidents',interval:5*MINUTE,staleAfter:20*MINUTE,url:()=>nifcUrl+'?'+new URLSearchParams({where:"IncidentTypeCategory = 'WF' AND FireOutDateTime IS NULL",outFields:'OBJECTID,IrwinID,IncidentName,IncidentTypeCategory,POOState,IncidentSize,PercentContained,FireDiscoveryDateTime,FireOutDateTime,ModifiedOnDateTime_dt',outSR:'4326',f:'geojson',orderByFields:'OBJECTID ASC',resultRecordCount:'2000',resultOffset:'0'}),normalize:normalizeNifc,scope:'Reported current wildfire locations in US viewing regions. Not fire perimeters or evacuation orders; incident updates vary.'},
  {id:'nwps',name:'NOAA River Flooding',interval:10*MINUTE,staleAfter:30*MINUTE,url:()=>riverUrl(0),normalize:normalizeNwps,scope:'US gauges with observed or forecast minor, moderate, or major flooding. Gauge points are not flood extents. Valid times are shown separately from feed fetch times.'},
  {id:'nws',name:'National Weather Service',interval:2*MINUTE,staleAfter:10*MINUTE,url:()=> 'https://api.weather.gov/alerts/active?status=actual&message_type=alert,update',normalize:normalizeNws,scope:'Active actual alerts; coverage depends on NWS reporting.'},
  {id:'usgs',name:'USGS Earthquakes',interval:MINUTE,staleAfter:5*MINUTE,url:()=> 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',normalize:normalizeUsgs,scope:'Past 24 hours within US viewing regions, including nearby offshore/border events.'},
  {id:'fema',name:'FEMA Disaster Declarations',interval:60*MINUTE,staleAfter:6*60*MINUTE,url:now=> 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?'+new URLSearchParams({'$filter':`declarationDate ge '${new Date(now-90*24*60*MINUTE).toISOString()}'`,'$orderby':'declarationDate desc','$top':'1000','$skip':'0'}),normalize:normalizeFema,scope:'Declarations from the past 90 days. Administrative context, not live incidents.'}
];
function createFeedService({fetchImpl=fetch,clock=Date.now,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
  const state=new Map(definitions.map(d=>[d.id,{events:[],lastSuccess:null,lastAttempt:null,error:null,inFlight:null}]));
  const zoneCache=new Map();
  async function getJson(url) {
    // NWS requires identification; other upstream CDNs may reject custom agents.
    const headers={'Accept':'application/geo+json, application/json'};
    if(new URL(url).hostname==='api.weather.gov') headers['User-Agent']='USSituationMap/1.0 (source-linked situational awareness dashboard)';
    const request=()=>fetchImpl(url,{headers,signal:AbortSignal.timeout(15000),redirect:'error'});
    let response=await request();
    if(response.status===429 && new URL(url).hostname==='mapservices.weather.noaa.gov') {
      const retry=response.headers.get('retry-after');
      const delay=retry===null?5000:/^\d+$/.test(retry)?Number(retry)*1000:Date.parse(retry)-clock();
      if(Number.isFinite(delay) && delay<=30000) {
        await response.body?.cancel();await wait(Math.max(1000,delay));response=await request();
      }
    }
    if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
    // Cap upstream payloads to avoid retaining unbounded source responses.
    const reader=response.body?.getReader();
    if (!reader) return response.json();
    let size=0;const chunks=[];
    try { for (;;) { const {done,value}=await reader.read();if(done) break;size+=value.length;if(size>25_000_000) throw new Error('Upstream payload too large');chunks.push(Buffer.from(value)); } }
    finally { await reader.cancel().catch(()=>{}); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  async function resolveZones(events) {
    const urls=[...new Set(events.filter(e=>!e.geometry).flatMap(e=>e.zoneUrls))].filter(url=>!zoneCache.has(url)||zoneCache.get(url).until<=clock());
    let cursor=0;
    async function worker() {
      while(cursor<urls.length) {
        const url=urls[cursor++],cached=zoneCache.get(url);
        if(cached && cached.until>clock()) continue;
        try { const data=await getJson(url);zoneCache.set(url,{geometry:data.geometry,until:clock()+24*60*MINUTE}); }
        catch { zoneCache.set(url,{geometry:null,until:clock()+10*MINUTE}); }
      }
    }
    // A bounded lookup budget keeps a national feed from waiting on thousands of zones.
    urls.splice(80);
    await Promise.all(Array.from({length:4},worker));
    for(const e of events) {
      if(!e.geometry) {
        const polygons=e.zoneUrls.flatMap(url=>{const g=zoneCache.get(url)?.geometry;return g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];});
        const geometry={type:'MultiPolygon',coordinates:polygons};
        const loc=location(geometry);
        // Never show a partial alert boundary as though it represents all affected zones.
        if(polygons.length && e.zoneUrls.every(url=>zoneCache.get(url)?.geometry) && loc) { e.geometry=geometry;e.location=loc;e.zoneDerived=true; }
      }
      delete e.zoneUrls;
    }
    if(zoneCache.size>5000) for(const [url,v] of zoneCache) if(v.until<clock()) zoneCache.delete(url);
  }
  async function refresh(d) {
    const s=state.get(d.id);
    if(s.inFlight) return s.inFlight;
    if(s.lastAttempt!==null && clock()-s.lastAttempt<d.interval) return;
    s.lastAttempt=clock();
    s.inFlight=(async()=>{
      try {
        const now=clock();let data;
        if(d.id==='nwps') {
          const gauges=new Map();
          for(const [layer,kind] of [[0,'observed'],[15,'forecast']]) {
            let offset=0;
            for(;;) {
              const page=await getJson(riverUrl(layer,offset));
              if(!Array.isArray(page?.features) || page.error) throw new Error('Invalid NOAA river GIS response');
              for(const f of page.features) {
                const p=f.properties||{};if(!p.gaugelid || f.geometry?.type!=='Point')continue;
                if(!gauges.has(p.gaugelid)) gauges.set(p.gaugelid,{lid:p.gaugelid,name:[p.waterbody,p.location].filter(Boolean).join(' at '),state:{abbreviation:p.state},longitude:f.geometry.coordinates[0],latitude:f.geometry.coordinates[1],status:{}});
                const g=gauges.get(p.gaugelid),raw=p[kind];
                g.status[kind]={floodCategory:p.status,primary:raw!==null && raw!==''?Number(raw):null,primaryUnit:p.units,validTime:riverTime(kind==='observed'?p.obstime:p.fcsttime)};
              }
              if(!page.exceededTransferLimit && !page.properties?.exceededTransferLimit && page.features.length<2000)break;
              if(!page.features.length || offset+page.features.length>=20000)throw new Error('Incomplete NOAA river pagination');
              offset+=page.features.length;
            }
          }
          data={gauges:[...gauges.values()]};
        } else data=await getJson(d.url(now));
        if(d.id==='nifc') {
          if(!Array.isArray(data?.features) || data.error) throw new Error('Invalid NIFC response');
          const records=[...data.features];
          while(data.exceededTransferLimit || data.properties?.exceededTransferLimit || data.features.length===2000) {
            if(records.length>=20000) throw new Error('NIFC pagination limit reached; retaining previous cache');
            const url=new URL(d.url(now));url.searchParams.set('resultOffset',String(records.length));
            data=await getJson(url.href);
            if(!Array.isArray(data?.features) || data.error) throw new Error('Invalid NIFC page');
            if(!data.features.length && (data.exceededTransferLimit || data.properties?.exceededTransferLimit)) throw new Error('Incomplete NIFC pagination');
            records.push(...data.features);
          }
          data={features:records};
        }
        if(d.id==='fema') {
          // OpenFEMA returns one record per designated area. Fetch every page before replacing cache.
          const records=[...data.DisasterDeclarationsSummaries || []];
          while(data.DisasterDeclarationsSummaries?.length===1000) {
            if(records.length>=20000) throw new Error('FEMA pagination limit reached; retaining previous cache');
            const url=new URL(d.url(now));url.searchParams.set('$skip',String(records.length));
            data=await getJson(url.href);if(!Array.isArray(data.DisasterDeclarationsSummaries)) throw new Error('Invalid OpenFEMA page');records.push(...data.DisasterDeclarationsSummaries);
          }
          data={DisasterDeclarationsSummaries:records};
        }
        const events=d.normalize(data,now);
        // Publish alerts promptly; missing geometry is explicitly reported, then improved on next refresh.
        s.events=events;s.lastSuccess=clock();s.error=null;
        if(d.id==='nws') await resolveZones(events);
      } catch(error) { s.error=error.name==='TimeoutError'?'Source request timed out':clean(error.message,200); }
      finally { s.inFlight=null; }
    })();
    return s.inFlight;
  }
  function snapshot() {
    const now=clock();
    return {generatedAt:new Date(now).toISOString(),events:definitions.flatMap(d=>state.get(d.id).events.filter(e=>!e.expires || Date.parse(e.expires)>now).map(e=>{const {zoneUrls,...publicEvent}=e;return publicEvent;})),sources:definitions.map(d=>{
      const s=state.get(d.id), stale=s.lastSuccess===null || now-s.lastSuccess>d.staleAfter;
      return {id:d.id,name:d.name,scope:d.scope,status:s.lastSuccess===null?(s.error?'unavailable':'loading'):s.error||stale?'stale':'ok',lastSuccess:s.lastSuccess===null?null:new Date(s.lastSuccess).toISOString(),lastAttempt:s.lastAttempt===null?null:new Date(s.lastAttempt).toISOString(),error:s.error,refreshSeconds:d.interval/1000};
    })};
  }
  return {snapshot,refreshAll:()=>Promise.allSettled(definitions.map(refresh))};
}
module.exports={createFeedService,normalizeNws,normalizeUsgs,normalizeFema,normalizeNifc,normalizeNwps,regionFor,definitions};
