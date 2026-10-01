'use strict';
const categories=[{id:'weather',name:'Weather & natural hazards',color:'#78c5ee',symbol:'●'},{id:'homeland',name:'Homeland security',color:'#c395f5',symbol:'◆'},{id:'foreign',name:'Geopolitical activity',color:'#ff968e',symbol:'▲'},{id:'infra',name:'Critical infrastructure',color:'#ffcc77',symbol:'■'}];
const scenarios=[
{id:1,cat:'weather',region:'Southeastern United States',lat:30,lon:-81,title:'Coastal storm preparation',priority:'High',text:'Exercise inject: a fictional coastal storm prompts shelter planning, evacuation route checks, and coordination with local emergency management.',action:'Review shelter capacity and continuity plans.'},
{id:2,cat:'homeland',region:'Middle Georgia, United States',lat:32.8,lon:-83.6,title:'Large-event security coordination',priority:'Moderate',text:'Exercise inject: a planned public gathering requires multiagency coordination, traffic control, and a shared communications plan.',action:'Confirm command assignments and mutual-aid contacts.'},
{id:3,cat:'infra',region:'Western United States',lat:38,lon:-120,title:'Regional power disruption',priority:'High',text:'Exercise inject: a fictional grid outage affects water pumps and transportation signals. Backup power and essential services are under review.',action:'Prioritize critical facilities and backup power.'},
{id:4,cat:'foreign',region:'North Atlantic',lat:53,lon:-30,title:'Maritime activity watch',priority:'Moderate',text:'Exercise inject: unusual vessel activity near a fictional shipping corridor prompts a maritime awareness briefing. No real actor is attributed.',action:'Assess potential effects on shipping and supply chains.'},
{id:5,cat:'foreign',region:'Eastern Europe',lat:48,lon:30,title:'Regional tension scenario',priority:'High',text:'Exercise inject: fictional foreign-adversary maneuvers raise regional tensions and create planning questions for travel, logistics, and humanitarian support.',action:'Review overseas dependencies and contingency options.'},
{id:6,cat:'weather',region:'Western Pacific',lat:19,lon:132,title:'Tropical cyclone exercise',priority:'High',text:'Exercise inject: a fictional tropical cyclone threatens coastal communities and port operations in the western Pacific.',action:'Evaluate port closures and alternate logistics routes.'},
{id:7,cat:'infra',region:'Red Sea corridor',lat:18,lon:40,title:'Shipping corridor disruption',priority:'Moderate',text:'Exercise inject: a fictional port closure delays essential cargo along a major shipping route.',action:'Identify alternate suppliers and delivery routes.'},
{id:8,cat:'weather',region:'Southern Africa',lat:-24,lon:28,title:'Extreme heat planning',priority:'Moderate',text:'Exercise inject: prolonged fictional heat conditions stress public health services and regional water supplies.',action:'Review heat response and resource distribution.'},
{id:9,cat:'homeland',region:'Western Europe',lat:49,lon:2,title:'Transportation security drill',priority:'Low',text:'Exercise inject: a regional transportation hub conducts a preparedness drill covering suspicious-item reporting and passenger communication.',action:'Validate reporting procedures and public messaging.'},
{id:10,cat:'weather',region:'South America',lat:-12,lon:-75,title:'Seismic response exercise',priority:'Moderate',text:'Exercise inject: a fictional earthquake triggers infrastructure inspections and search-and-rescue coordination.',action:'Review damage assessment and mutual-aid activation.'},
{id:11,cat:'foreign',region:'Indo-Pacific',lat:10,lon:112,title:'Foreign-adversary activity scenario',priority:'Moderate',text:'Exercise inject: fictional military exercises near an international sea lane prompt analysis of regional supply-chain exposure. No real nation is accused.',action:'Brief leadership on transport and economic dependencies.'},
{id:12,cat:'infra',region:'Australia',lat:-32,lon:145,title:'Water system continuity drill',priority:'Low',text:'Exercise inject: a fictional treatment facility outage requires temporary supply arrangements and public information coordination.',action:'Verify alternative water distribution plans.'}];
const $=id=>document.getElementById(id),active=new Set(categories.map(c=>c.id));
const MAX_ACTIVE_EVENTS=36;
let selected=1,paused=false,elapsed=0,serial=24,nextArrival=3,nextFocus=9;
const readinessSpeeds={5:0.5,4:0.75,3:1,2:2,1:4};
let eventSpeed=1;
const paths={
storm:'<path d="M5 15a4 4 0 0 1 0-8 6 6 0 0 1 11-1 4 4 0 0 1 2 9M12 11l-3 6h5l-3 6"/>',
shield:'<path d="M12 2l8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5zM8 12l3 3 5-6"/>',
power:'<path d="M13 2L4 14h7l-1 8 10-13h-7z"/>',
ship:'<path d="M4 15l8-3 8 3-3 5H7zM8 13V7h8v6M12 7V3M3 22q3-3 6 0 3-3 6 0 3-3 6 0"/>',
radar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l7-7"/><circle cx="9" cy="15" r="1"/>',
heat:'<circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2"/>',
quake:'<path d="M2 13h4l3-8 4 15 3-10 2 3h4"/>',
water:'<path d="M12 2s-7 8-7 13a7 7 0 0 0 14 0c0-5-7-13-7-13zM9 16q0 3 3 3"/>'};
scenarios.forEach((s,i)=>s.icon=['storm','shield','power','ship','radar','storm','ship','heat','shield','quake','radar','water'][i]);
Object.assign(paths,{
 fire:'<path d="M13 2c2 6-3 6 1 10 1-2 3-3 4-4 5 8 1 14-6 14S2 15 6 9c0 4 3 4 4 2s-1-5 3-9z"/>',
 snow:'<path d="M12 2v20M3 7l18 10M3 17L21 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1V5M20 14l-4 1v4M4 14l4 1v4M20 10l-4-1V5"/>',
 volcano:'<path d="M2 21l7-13h6l7 13zM7 12l5 3 5-3M9 5l-2-3M12 5V1M15 5l2-3"/>',
 wind:'<path d="M2 8h13a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M2 16h7a3 3 0 1 1-3 3"/>',
 rescue:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5"/><path d="M5 5l4 4M15 15l4 4M5 19l4-4M15 9l4-4"/>',
 hazmat:'<path d="M12 2L1 22h22zM12 8v7M12 18v1"/>',
 aircraft:'<path d="M12 2l2 8 8 4v3l-8-2v5l3 2H7l3-2v-5l-8 2v-3l8-4z"/>',
 rail:'<rect x="5" y="2" width="14" height="16" rx="3"/><path d="M5 10h14M12 2v8M8 18l-3 4M16 18l3 4M7 21h10"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/>',
 medical:'<path d="M8 2h8v6h6v8h-6v6H8v-6H2V8h6z"/>',
 comms:'<path d="M12 9v13M8 22h8M8 8a6 6 0 0 1 8 0M5 5a10 10 0 0 1 14 0"/><circle cx="12" cy="11" r="2"/>'
});
scenarios.push(...window.EXTRA_SCENARIOS);
// Shuffle without replacement: each catalog entry gets a turn before repeating.
function shuffle(list){const items=[...list];for(let i=items.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[items[i],items[j]]=[items[j],items[i]]}return items}
let pending=shuffle(scenarios);
const htmlCache=new Map();
function setHTML(id,value){if(htmlCache.get(id)!==value){$(id).innerHTML=value;htmlCache.set(id,value)}}
function setText(node,value){if(node.textContent!==String(value))node.textContent=value}
const icon=s=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[s.icon]+'</svg>';
const category=id=>categories.find(c=>c.id===id);
document.querySelector('.controls').prepend($('filters'));
document.querySelector('.map-footer').innerHTML=categories.map(c=>'<span style="color:'+c.color+'">'+icon({icon:{weather:'storm',homeland:'shield',foreign:'radar',infra:'power'}[c.id]})+c.name+'</span>').join('');
const opening=[0,17,19,26,36,39,53,59].map(index=>scenarios[index]);
opening.push(...shuffle(scenarios.filter(s=>!opening.some(e=>e.id===s.id))).slice(0,16));
let live=opening.map((s,i)=>({...s,uid:i+1,born:-i*2,expires:60+i*2}));
pending=pending.filter(s=>!live.some(e=>e.id===s.id));
let log=live.slice(-3).map(s=>({...s,at:0,state:'DETECTED'}));
const point=(lon,lat)=>[(lon+180)/360*1000,(90-lat)/180*500];
for(const country of window.WORLD_DATA.countries){const polygons=country.geomType==='Polygon'?[country.coordinates]:country.coordinates;const d=polygons.map(poly=>poly.map(ring=>ring.map(([lon,lat],i)=>`${i?'L':'M'}${point(lon,lat).map(v=>v.toFixed(2)).join(',')}`).join(' ')+'Z').join(' ')).join(' ');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);path.setAttribute('class','country');$('countries').append(path)}
function select(id){selected=id;render()}
function record(s,state){log.push({...s,at:elapsed,state});log=log.slice(-20)}
function render(){
 const visible=live.filter(s=>active.has(s.cat));
 if(!visible.some(s=>s.id===selected))selected=visible.at(-1)?.id;
 setHTML('filters',categories.map(c=>`<button class="filter" title="${c.name}" data-cat="${c.id}" aria-pressed="${active.has(c.id)}" style="--color:${c.color}"><span>${icon({icon:{weather:'storm',homeland:'shield',foreign:'radar',infra:'power'}[c.id]})}${c.name}</span><b>${live.filter(s=>s.cat===c.id).length}</b></button>`).join(''));
 const markers=$('markers'),uids=new Set(visible.map(s=>String(s.uid)));
 for(const node of [...markers.children])if(!uids.has(node.dataset.uid))node.remove();
 for(const s of visible){
  let node=markers.querySelector('[data-uid="'+s.uid+'"]');const c=category(s.cat);
  if(!node){
   node=document.createElementNS('http://www.w3.org/2000/svg','g');const [x,y]=point(s.lon,s.lat);
   node.setAttribute('transform',`translate(${x},${y})`);node.setAttribute('style',`--color:${c.color}`);
   node.setAttribute('role','button');node.setAttribute('tabindex','0');node.setAttribute('aria-label',s.title+', '+s.region);
   node.dataset.id=s.id;node.dataset.uid=s.uid;
   node.innerHTML=`<title>${s.title} — ${s.region}</title><circle class="halo" r="22"/><circle class="arrival-ring" r="13"/><circle class="core" r="12"/><g class="event-icon" transform="translate(-8,-8) scale(.67)">${paths[s.icon]}</g><text class="location-label" text-anchor="middle" y="28"></text>`;markers.append(node);
  }
  const classes=`marker ${selected===s.id?'selected':''} ${s.expires-elapsed<6?'leaving':''}`;
  if(node.getAttribute('class')!==classes)node.setAttribute('class',classes);
  const ring=node.querySelector('.arrival-ring'),display=elapsed-s.born<10?'':'none';
  if(ring.style.display!==display)ring.style.display=display;
  setText(node.querySelector('.location-label'),selected===s.id?s.region:'');
 }
 const s=visible.find(s=>s.id===selected);
 setHTML('detail',s?`<div class="detail-top"><span>${elapsed-s.born<10?'NEW ARRIVAL':'MONITORING'} / ${s.region.toUpperCase()}</span><span class="badge ${s.priority}">${s.priority.toUpperCase()}</span></div><h3>${s.title}</h3><p>${s.action}</p>`:'<h3>No layers selected</h3><p>Enable a threat layer to view exercise events.</p>');
 setText($('total'),live.length);setText($('high'),live.filter(s=>s.priority==='High').length);setText($('visible'),visible.length);
 setText($('map-count'),`${visible.length} ACTIVE · ${visible.filter(s=>s.priority==='High').length} HIGH PRIORITY`);
 const bulletins=visible.slice().sort((a,b)=>b.born-a.born).slice(0,3);
 setHTML('bulletins',bulletins.map(s=>`<button class="bulletin" data-id="${s.id}" style="--color:${category(s.cat).color}"><span class="bulletin-icon">${icon(s)}</span><small>${elapsed-s.born<10?'NEW EVENT':'MONITORING'} / ${s.priority.toUpperCase()}</small><h3>${s.title}</h3><p>${s.region}<br>${s.action}</p><div class="life"><span></span></div><div class="life-label"></div></button>`).join('')||'<p class="muted">No events in selected layers.</p>');
 for(const s of bulletins){
  const card=$('bulletins').querySelector('[data-id="'+s.id+'"]');
  card.querySelector('.life span').style.transform='scaleX('+Math.max(0,(s.expires-elapsed)/(s.expires-s.born)).toFixed(3)+')';
  setText(card.querySelector('.life-label'),s.expires-elapsed<6?'CLEARING FROM DISPLAY':'EXERCISE EVENT · '+Math.max(0,Math.ceil((s.expires-elapsed)/eventSpeed))+'s REMAINING');
 }
 setHTML('events',log.filter(e=>active.has(e.cat)).slice(-1).map(e=>`<tr tabindex="0" data-id="${e.id}" class="${elapsed-e.at<2?'new-row':''}" aria-label="Inspect ${e.title}"><td>T+${String(Math.floor(e.at/60)).padStart(2,'0')}:${String(Math.floor(e.at%60)).padStart(2,'0')}</td><td>${e.region}</td><td><span class="${e.state==='CLEARED'?'Low':'ticker-message'}">${e.state}</span> · ${e.title}</td><td>${category(e.cat).name}</td><td><span class="badge ${e.priority}">${e.priority.toUpperCase()}</span></td></tr>`).join('')||'<tr><td colspan="5">No logged events match the selected layers.</td></tr>');
 setText($('updated'),`NEXT EVENT ${Math.max(0,Math.ceil((nextArrival-elapsed)/eventSpeed))}s · ${eventSpeed}× PACE · ${live.length} ACTIVE`);
}
function advance(renderNow=true){
 if(live.length>=MAX_ACTIVE_EVENTS){nextArrival=elapsed+1;return}
 if(!pending.length)pending=shuffle(scenarios);
 const index=pending.findIndex(s=>!live.some(e=>e.id===s.id));
 if(index<0){nextArrival=elapsed+3;return}
 const source=pending.splice(index,1)[0];
 const s={...source,uid:++serial,born:elapsed,expires:elapsed+90+Math.floor(Math.random()*31)};
 live.push(s);record(s,'DETECTED');if(active.has(s.cat))selected=s.id;
 nextArrival=elapsed+3+Math.floor(Math.random()*2);
 if(renderNow)render();
}
document.addEventListener('click',e=>{const layer=e.target.closest('[data-cat]');if(layer){active.has(layer.dataset.cat)?active.delete(layer.dataset.cat):active.add(layer.dataset.cat);render()}const item=e.target.closest('[data-id]');if(item&&live.some(s=>s.id===Number(item.dataset.id)))select(Number(item.dataset.id))});
document.addEventListener('keydown',e=>{const item=e.target.closest('[data-id]');if(item&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(live.some(s=>s.id===Number(item.dataset.id)))select(Number(item.dataset.id))}});
const names={5:'ROUTINE',4:'GUARDED',3:'ELEVATED',2:'HIGH',1:'CRITICAL'},postures={5:'Normal exercise monitoring and preparedness.',4:'Increase awareness and review response procedures.',3:'Coordinate agencies and review available resources.',2:'Prepare exercise teams for immediate activation.',1:'Simulate full emergency response activation.'};
function setReadiness(){const n=Number($('readiness').value);eventSpeed=readinessSpeeds[n];$('level-number').textContent=n;$('level-name').textContent=names[n];$('posture').textContent=postures[n];$('levels').innerHTML=[5,4,3,2,1].map(v=>`<button class="${v===n?'active':''}" data-level="${v}" aria-pressed="${v===n}" aria-label="Level ${v}, ${names[v]}, ${readinessSpeeds[v]} times event pace">${v}</button>`).join('');$('pace').textContent=`${eventSpeed}× EVENT PACE`;document.documentElement.style.setProperty('--pulse-duration',`${2.6/eventSpeed}s`);document.documentElement.style.setProperty('--arrival-duration',`${3/eventSpeed}s`);document.documentElement.style.setProperty('--sweep-duration',`${12/eventSpeed}s`);render()}
$('levels').addEventListener('click',e=>{const button=e.target.closest('[data-level]');if(button){$('readiness').value=button.dataset.level;setReadiness()}});
$('readiness').addEventListener('change',setReadiness);$('advance').addEventListener('click',advance);$('reset').addEventListener('click',()=>{categories.forEach(c=>active.add(c.id));render()});
$('pause').addEventListener('click',()=>{paused=!paused;document.body.classList.toggle('paused',paused);$('pause').textContent=paused?'▶ Resume':'Ⅱ Pause';$('pause').setAttribute('aria-pressed',String(paused));$('feed-status').textContent=paused?'SIMULATION PAUSED':'SIMULATED EVENTS · AUTO UPDATING'});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{$('fullscreen').textContent='Full screen unavailable'}});document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'Exit full screen ↙':'Full screen ↗'});
let lastTick=performance.now(),lastPaint=0;
setInterval(()=>{
 const now=performance.now(),delta=Math.min(1,(now-lastTick)/1000);lastTick=now;
 if(document.hidden)return;
 setText($('clock'),new Date().toISOString().slice(11,19)+' UTC');
 if(paused)return;
 elapsed+=eventSpeed*delta;
 const expired=live.filter(s=>s.expires<=elapsed);let changed=expired.length>0;
 expired.forEach(s=>record(s,'CLEARED'));if(changed)live=live.filter(s=>s.expires>elapsed);
 if(elapsed>=nextArrival){advance(false);changed=true}
 if(elapsed>=nextFocus){const choices=live.filter(s=>active.has(s.cat));if(choices.length)selected=choices[Math.floor(elapsed/9)%choices.length].id;nextFocus=elapsed+9;changed=true}
 if(changed||now-lastPaint>=1000){render();lastPaint=now}
},250);
$('clock').textContent=new Date().toISOString().slice(11,19)+' UTC';setReadiness();render();

