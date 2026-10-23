'use strict';
const http=require('node:http');
// Native Node proxy support preserves the managed environment’s HTTPS proxy and CA trust.
if (http.setGlobalProxyFromEnv) http.setGlobalProxyFromEnv();
const fs=require('node:fs');
const path=require('node:path');
const {createFeedService}=require('./feeds.cjs');
const PUBLIC=new Set(['index.html','app.js','style.css','regions.js','assets/world-data.js','assets/us-states.js','assets/mga-logo.png']);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'};
function createServer(service=createFeedService()) {
  return http.createServer((req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if(req.method!=='GET' && req.method!=='HEAD') {res.writeHead(405,{'Allow':'GET, HEAD'});return res.end();}
    let pathname;
    try {pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);} catch {res.writeHead(400);return res.end();}
    if(pathname==='/api/events') {
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      return res.end(req.method==='HEAD'?undefined:JSON.stringify(service.snapshot()));
    }
    const file=pathname==='/'?'index.html':pathname.slice(1);
    if(!PUBLIC.has(file)) {res.writeHead(404);return res.end('Not found');}
    fs.readFile(path.join(__dirname,file),(error,data)=>{
      if(error) {res.writeHead(500);return res.end('Unable to read asset');}
      res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache'});
      res.end(req.method==='HEAD'?undefined:data);
    });
  });
}
if(require.main===module) {
  const service=createFeedService();
  const server=createServer(service);
  server.listen(Number(process.env.PORT || 8080),'0.0.0.0',()=>console.log(`US Situation Map listening on port ${server.address().port}`));
  service.refreshAll();
  const timer=setInterval(()=>service.refreshAll(),15000);
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{clearInterval(timer);server.close(()=>process.exit(0));});
}
module.exports={createServer};
