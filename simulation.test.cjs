const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Run the actual catalog, clock, readiness, and event lifecycle without a browser.
// Rendering is checked separately in the browser; this isolates long-run behavior.
const nodes = new Map();
function element(id) {
  if (!nodes.has(id)) nodes.set(id, {value: '3',textContent: '',writes: 0,
    set innerHTML(value) { this.html = value; this.writes++; },
    get innerHTML() { return this.html; },
    style: {setProperty() {}},prepend() {},before() {},setAttribute() {},addEventListener() {}});
  return nodes.get(id);
}
let now = 0, tick;
const context = vm.createContext({window:{WORLD_DATA:{countries:[]}},
  document:{hidden:false,getElementById:element,querySelector:element,
    createElementNS:()=>element('svg'),documentElement:element('root'),
    body:{classList:{toggle(){}}},addEventListener(){}},
  performance:{now:()=>now},setInterval(callback){tick=callback;},Date,console});
vm.runInContext(fs.readFileSync('event-catalog.js','utf8'), context);
let source = fs.readFileSync('app.js','utf8');
const begin = source.indexOf('function render(){'),end = source.indexOf('function advance(',begin);
source = source.slice(0,begin)+'function render() {}\n'+source.slice(end);
vm.runInContext(source, context);
const read = code=>vm.runInContext(code,context);
const step = count=>{for(let i=0;i<count;i++){now+=250;tick();}};
assert.equal(read('scenarios.length'),60);
assert.equal(read('new Set(scenarios.map(s=>s.id)).size'),60);
assert.equal(read('new Set(scenarios.map(s=>s.icon)).size'),18);
assert.ok(read('scenarios.every(s=>paths[s.icon] && Math.abs(s.lat)<=90 && Math.abs(s.lon)<=180)'));
assert.equal(read('live.length'),24);
assert.equal(read('pending.length'),36);
// No repeats until all 60 entries, including the seeded ones, have had a turn.
const seen = new Set(read('live.map(s=>s.id)'));
for(let i=0;i<36;i++){
  read('live=[];advance(false)');
  const id=read('live[0].id');assert.ok(!seen.has(id));seen.add(id);
}
assert.equal(seen.size,60);
for(const [level,speed] of [[5,.5],[4,.75],[3,1],[2,2],[1,4]]){
  element('readiness').value=String(level);read('setReadiness()');
  const before=read('elapsed');step(4);assert.equal(read('elapsed')-before,speed);
}
read('paused=true');const frozen=read('elapsed');step(40);assert.equal(read('elapsed'),frozen);
read('paused=false');context.document.hidden=true;step(40);assert.equal(read('elapsed'),frozen);
context.document.hidden=false;
// Fast-mode soak: 2,500 real seconds / 10,000 simulation seconds.
let maximum=0,totalActive=0;
for(let i=0;i<10000;i++){step(1);maximum=Math.max(maximum,read('live.length'));
  assert.ok(read('new Set(live.map(s=>s.id)).size===live.length'));
  assert.ok(read('live.every(s=>s.expires>elapsed)'));assert.ok(read('log.length<=20'));
  if(i>=1000)totalActive+=read('live.length');
}
assert.ok(maximum<=36,'live event collection must remain bounded');
assert.ok(totalActive/9000>=24,'sustained display must remain populated');
read('for(let i=0;i<100;i++)advance(false)');
assert.ok(read('live.length<=MAX_ACTIVE_EVENTS'),'manual arrivals must respect the cap');
read("setHTML('probe','same');setHTML('probe','same');setHTML('probe','changed')");
assert.equal(element('probe').writes,2,'unchanged markup must not replace DOM');
console.log(`PASS: 60 unique scenarios, 18 icons, all speed levels, pause/hidden tabs, no-repeat cycle, 10,000-tick soak (max ${maximum} live events), and cached DOM writes.`);
