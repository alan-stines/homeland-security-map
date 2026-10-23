'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {createServer}=require('../server.cjs');
test('HTTP workflow serves dashboard, API and assets while protecting server files',async t=>{
 const snapshot={generatedAt:new Date().toISOString(),events:[],sources:[{id:'nws',status:'unavailable'}]};
 const server=createServer({snapshot:()=>snapshot});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const response=await fetch(base);assert.equal(response.status,200);assert.match(await response.text(),/US Situation Map/);assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);
 assert.deepEqual(await (await fetch(base+'/api/events')).json(),snapshot);
 for(const asset of ['app.js','regions.js','style.css','assets/world-data.js','assets/us-states.js','assets/mga-logo.png'])assert.equal((await fetch(base+'/'+asset)).status,200,asset);
 for(const file of ['server.cjs','feeds.cjs','.git/config','package.json','%2e%2e/server.cjs'])assert.equal((await fetch(base+'/'+file)).status,404,file);
 assert.equal((await fetch(base+'/api/events',{method:'POST'})).status,405);
});
