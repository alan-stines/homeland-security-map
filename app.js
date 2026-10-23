'use strict';
const $=id=>document.getElementById(id);
const svgNS='http://www.w3.org/2000/svg';
const regionDefinitions=window.US_REGIONS;
let currentRegion=regionDefinitions[0], selected=null, payload={events:[],sources:[]}, busy=false, lastReceived=null;
const enabled=new Set(['weather','earthquake','wildfire','river']);
const sourceNames={nws:'NWS',usgs:'USGS',fema:'FEMA',nifc:'NIFC',nwps:'NOAA NWPS'};
function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
function svg(tag,attrs){const node=document.createElementNS(svgNS,tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);return node;}
function date(value){return value?new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}):'Not available';}
function sourceStatus(id){return payload.sources.find(s=>s.id===id);}
function badge(e){return el('span',e.severity,'badge '+e.severity);}
function activeEvents(){return payload.events.filter(e=>!e.expires || Date.parse(e.expires)>Date.now());}
function matches(e){const q=$('search').value.trim().toLowerCase();return !q || `${e.title} ${e.area} ${sourceNames[e.source]}`.toLowerCase().includes(q);}
function inRegion(e){
 if(!e.location)return false;
 const b=currentRegion.bounds;
 if(e.geometry?.type==='Point')return e.location.lon>=b[0]&&e.location.lon<=b[2]&&e.location.lat>=b[1]&&e.location.lat<=b[3];
 return polygons(e.geometry).some(p=>p[0]?.some(([lon,lat])=>lon>=b[0]&&lon<=b[2]&&lat>=b[1]&&lat<=b[3]));
}
function visible(){return activeEvents().filter(e=>enabled.has(e.category)&&matches(e)&&inRegion(e));}
function polygons(g){return g?.type==='MultiPolygon'?g.coordinates:g?.type==='Polygon'?[g.coordinates]:[];}
function projection(){const [west,south,east,north]=currentRegion.bounds;const cos=Math.cos((north+south)/2*Math.PI/180),height=(north-south)/(east-west)/cos*960;return {height,point:(lon,lat)=>[(lon-west)/(east-west)*960,(north-lat)/(north-south)*height]};}
function geometryPath(g,point){return polygons(g).map(p=>p.map(ring=>ring.map(([lon,lat],i)=>`${i?'L':'M'}${point(lon,lat).map(n=>n.toFixed(2)).join(',')}`).join(' ')+'Z').join(' ')).join(' ');}
function choose(id){selected=id;render();}
function bindSelection(node,e){node.dataset.id=e.id;node.setAttribute('tabindex','0');node.setAttribute('role','button');node.setAttribute('aria-label',e.title+', '+e.area);node.addEventListener('click',()=>choose(e.id));node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(e.id);}});}
function renderBase(){
 const {height,point}=projection();$('map').setAttribute('viewBox',`0 0 960 ${height}`);$('clip-rect').setAttribute('width',960);$('clip-rect').setAttribute('height',height);
 $('map').setAttribute('aria-label',currentRegion.name+' weather alerts, wildfires, river flooding and earthquakes');
 const nodes=[];
 for(const c of window.WORLD_DATA.countries){
  const g={type:c.geomType,coordinates:c.coordinates};
  // Separate polygons crossing the date line instead of drawing a line across the entire map.
  const parts=polygons(g).filter(p=>p[0]?.some(([lon,lat])=>lon>=currentRegion.bounds[0]-15&&lon<=currentRegion.bounds[2]+15&&lat>=currentRegion.bounds[1]-10&&lat<=currentRegion.bounds[3]+10));
  if(parts.length)nodes.push(svg('path',{d:geometryPath({type:'MultiPolygon',coordinates:parts},point),class:'country'+(['US','PR'].includes(c.id)?'':' context'),'fill-rule':'evenodd'}));
 }
 $('countries').replaceChildren(...nodes);
 $('states').replaceChildren(...window.US_STATES.features.map(f=>svg('path',{d:geometryPath(f.geometry,point),class:'state-boundary','fill-rule':'evenodd'})));
 $('regions').replaceChildren(...regionDefinitions.map(r=>{const b=el('button',r.name);b.setAttribute('aria-pressed',r.id===currentRegion.id);b.addEventListener('click',()=>{currentRegion=r;renderBase();render();});return b;}));
}
function renderMap(events){
 const {point}=projection();const areas=[],markers=[];
 // Larger polygons first so smaller warning areas remain selectable.
 for(const e of events){
  if(e.geometry?.type==='Point'){
   const [x,y]=point(e.location.lon,e.location.lat),cls='quake '+e.category+(e.id===selected?' selected':'');
   const node=e.category==='wildfire'?svg('path',{d:'M0,-7 L7,6 L-7,6 Z',transform:`translate(${x},${y})`,class:cls}):e.category==='river'?svg('path',{d:'M0,-7 L6,0 L0,7 L-6,0 Z',transform:`translate(${x},${y})`,class:cls}):svg('circle',{cx:x,cy:y,r:e.severity==='Severe'?9:6,class:cls});
   bindSelection(node,e);node.append(svg('title',{}));node.firstChild.textContent=e.title+' · '+e.area;markers.push(node);
  }else{
   const node=svg('path',{d:geometryPath(e.geometry,point),class:'alert-area '+e.severity+(e.id===selected?' selected':''),'fill-rule':'evenodd'});bindSelection(node,e);const title=svg('title',{});title.textContent=e.title+' · '+e.area;node.append(title);areas.push(node);
  }
 }
 $('areas').replaceChildren(...areas);$('markers').replaceChildren(...markers);
}
function renderDetail(){
 const e=activeEvents().find(e=>e.id===selected),target=$('detail');
 target.replaceChildren();
 if(!e){target.append(el('h3','Select an alert or reported condition'),el('p','Choose a map area or a list entry to see its source, timestamps, and official guidance. Empty feeds do not establish that an area is safe.'));return;}
 const source=sourceStatus(e.source);
 target.append(badge(e),el('h3',e.title),el('p',e.area));
 if(e.source==='nwps')target.append(el('p','Observed and forecast valid times are listed below. Feed fetch time appears in Source health.'));
 const dl=el('dl');
 for(const [label,value] of [['Source',source?.name||sourceNames[e.source]],[e.source==='nwps'?'Gauge valid':'Issued',date(e.issued)],[e.source==='nwps'?'Fetched':'Revised',date(e.source==='nwps'?source?.lastSuccess:e.updated)],['Expires',e.source==='usgs'?'24-hour display window':e.source==='nifc'?'Until source removes incident':e.source==='nwps'?'Replaced on source refresh':e.expires?date(e.expires):'Administrative context'],['Feed',source?.status||'Unknown']])dl.append(el('dt',label),el('dd',value));
 target.append(dl);
 if(source?.status!=='ok')target.append(el('p','SOURCE DEGRADED — verify this information at the official source.'));
 if(e.zoneDerived)target.append(el('p','Map boundary uses affected NWS forecast zones.'));
 if(!e.location && e.source==='nws')target.append(el('p','Area geometry is unavailable; this alert is listed without a map marker.'));
 target.append(el('p',e.description,'body-text'),el('h4','Source guidance'),el('p',e.instruction||'No instructions supplied. Consult the official source.','body-text'));
 if(e.url){const a=el('a','Open official '+sourceNames[e.source]+' source ↗');a.href=e.url;a.target='_blank';a.rel='noopener noreferrer';target.append(a);}
}
function render(){
 const events=visible(),unmapped=activeEvents().filter(e=>e.source==='nws'&&!e.location&&enabled.has(e.category)&&matches(e));
 const all=[...events,...unmapped].sort((a,b)=>({Extreme:0,Severe:1,Moderate:2,Minor:3,Unknown:4}[a.severity]??5)-({Extreme:0,Severe:1,Moderate:2,Minor:3,Unknown:4}[b.severity]??5)||Date.parse(b.issued)-Date.parse(a.issued));
 renderMap(events);renderDetail();
 $('map-count').textContent=`${events.length} mapped records`;
 for(const type of ['weather','earthquake','wildfire','river'])$(type+'-count').textContent=activeEvents().filter(e=>e.category===type&&inRegion(e)).length;
 $('map-summary').textContent=`${unmapped.length} NWS alerts nationwide have no resolved map geometry. Overlapping alerts can cover the same area.`;
 $('list-count').textContent=`${all.length} results${all.length>100?' · showing first 100':''}`;
 const rows=all.slice(0,100).map(e=>{const b=el('button',undefined,'event-row');b.setAttribute('aria-pressed',e.id===selected);b.append(badge(e),el('strong',e.title),el('small',e.area+(e.location?'':' · Unmapped')),el('small',sourceNames[e.source]+' · '+date(e.issued)));b.addEventListener('click',()=>choose(e.id));return b;});
 $('events').replaceChildren(...(rows.length?rows:[el('p','No records available for this view. Check source health; missing data does not mean no incidents.','muted')]));
 $('sources').replaceChildren(...payload.sources.map(s=>{
  const box=el('div',undefined,'source'),heading=el('h4',s.name);heading.append(el('span',s.status,'status '+s.status));
  box.append(heading,el('p',s.scope),el('p',`Last successful fetch: ${date(s.lastSuccess)} · Refresh ${s.refreshSeconds/60} min`));
  if(s.error)box.append(el('p','Latest fetch failed: '+s.error));return box;
 }));
 const declarations=activeEvents().filter(e=>e.source==='fema').sort((a,b)=>Date.parse(b.issued)-Date.parse(a.issued));
 $('declarations').replaceChildren(...(declarations.length?declarations.map(e=>{const b=el('button',undefined,'declaration');b.append(el('strong',e.title),el('small',e.area+' · Declared '+date(e.issued)));b.addEventListener('click',()=>choose(e.id));return b;}):[el('p','No declaration data available. Check FEMA source health.','muted')]));
}
async function refresh(){
 if(busy)return;busy=true;$('refresh').disabled=true;
 try{
  const response=await fetch('/api/events',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Dashboard service HTTP '+response.status);
  const data=await response.json();if(!Array.isArray(data.events)||!Array.isArray(data.sources))throw new Error('Unexpected server response');
  payload=data;lastReceived=Date.now();
  const healthy=data.sources.filter(s=>s.status==='ok').length;
  $('connection').textContent=healthy===data.sources.length&&healthy?`All ${healthy} sources responding. Records follow each source’s reporting schedule.`:`${healthy} of ${data.sources.length} sources current. Loading or unavailable feeds do not indicate an absence of incidents. Check source health below.`;
  $('updated').textContent='Display checked '+date(data.generatedAt);render();
 }catch(error){$('connection').textContent='Dashboard connection failed. Previously fetched records may be stale; verify official sources. '+error.message;}
 finally{busy=false;$('refresh').disabled=false;}
}
$('filters').addEventListener('change',e=>{if(e.target.checked)enabled.add(e.target.value);else enabled.delete(e.target.value);render();});
$('search').addEventListener('input',render);
$('refresh').addEventListener('click',refresh);
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('connection').textContent='Full screen is unavailable in this browser.';}});
setInterval(()=>{ $('clock').textContent=new Date().toISOString().slice(11,19)+' UTC';if(lastReceived && Date.now()-lastReceived>90000)$('connection').textContent='Display updates are delayed. Data may be stale; check official sources.'; },1000);
setInterval(()=>{render();refresh();},30000);
renderBase();render();refresh();
