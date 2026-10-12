import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

async function worker(firstInstall = false) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/app/sw.js/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,Date,Response});
  const listeners = new Map();
  const stores = new Map([['unrelated',new Map()],['mreyes-shell-oldest',new Map()],['mreyes-shell-previous',new Map([['/_next/static/old.js',new Response('previous chunk')]])]]);
  if (firstInstall) { stores.delete("mreyes-shell-oldest"); stores.delete("mreyes-shell-previous"); }
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async key => stores.delete(key),
    open: async key => {
      if (!stores.has(key)) stores.set(key,new Map());
      const cache = stores.get(key);
      return {match:async request=>cache.get(typeof request === 'string' ? request : new URL(request.url).pathname),put:async (request,response)=>cache.set(typeof request === 'string' ? request : new URL(request.url).pathname,response)};
    },
    match: async request => {for(const cache of stores.values()){const value=cache.get(new URL(request.url).pathname);if(value)return value;}}
  };
  let activations=0;
  const navigations=[];
  const windows=["/","/account","/accept-invite?token=test","/reset-password?token=test"].map(path=>({url:`https://example.test${path}`,navigate:async url=>navigations.push(url)}));
  vm.runInNewContext(await exports.GET().text(),{
    self:{location:{origin:'https://example.test'},clients:{claim:async()=>{},matchAll:async()=>windows},addEventListener:(name,callback)=>listeners.set(name,callback),skipWaiting:()=>{activations++;}},
    caches,URL,fetch:async path=>new Response(path==='/' ? '<html><script src="/_next/static/new.js"></script></html>' : 'new chunk',{headers:{'content-type':path==='/'?'text/html':'application/javascript'}})
  });
  async function lifecycle(name) {let pending;listeners.get(name)({waitUntil:promise=>{pending=promise;}});await pending;}
  return {listeners, stores, lifecycle, navigations, activations:()=>activations};
}

test('updates activate automatically after assets are ready and preserve previous immutable chunks', async()=>{
  const h=await worker();
  await h.lifecycle('install');
  assert.equal(h.activations(),1);
  h.listeners.get('message')({data:{type:'SKIP_WAITING'}});
  assert.equal(h.activations(),2);
  await h.lifecycle('activate');
  assert.deepEqual(h.navigations,['https://example.test/','https://example.test/account']);
  assert.equal(h.stores.has('unrelated'),true);
  assert.equal(h.stores.has('mreyes-shell-oldest'),false);
  assert.equal(h.stores.has('mreyes-shell-previous'),true);
  let pending;
  h.listeners.get('fetch')({request:new Request('https://example.test/_next/static/old.js'),respondWith:promise=>{pending=promise;}});
  assert.equal(await (await pending).text(),'previous chunk');
});

test('private API and authentication requests are never intercepted or cached',async()=>{
  const h=await worker();
  let intercepted=false;
  for(const path of ['/api/v1/auth/refresh','/api/v1/dashboard','/account','/baselines'])
    h.listeners.get('fetch')({request:new Request(`https://example.test${path}`),respondWith:()=>{intercepted=true;}});
  assert.equal(intercepted,false);
});

test('first installation activates without refreshing open forms',async()=>{
 const h=await worker(true);
 await h.lifecycle('install');await h.lifecycle('activate');
 assert.equal(h.activations(),1);assert.deepEqual(h.navigations,[]);
});
