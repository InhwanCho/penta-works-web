import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { QueryClient } from '@tanstack/react-query';
const source = ts.transpileModule(fs.readFileSync(new URL('../src/lib/public-auth-query.ts', import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function load(apiFetch) {
 const exported={};
 vm.runInNewContext(source,{exports:exported,require:name=>name==='@/lib/api'?{apiFetch}:{QueryClient},AbortController,setTimeout,clearTimeout,Error});
 return exported;
}
test('anonymous session expiry preserves both pending and loaded public token queries while clearing private data',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 let complete;
 const pending=client.fetchQuery({queryKey:['invitation','pending'],queryFn:()=>new Promise(resolve=>complete=resolve)});
 client.setQueryData(['password-reset','token'],{name:'Preview'});
 client.setQueryData(['dashboard'],{private:true});
 const {clearPrivateQueries}=load(()=>{});
 clearPrivateQueries(client);
 assert.equal(client.getQueryData(['dashboard']),undefined);
 assert.equal(client.getQueryData(['password-reset','token']).name,'Preview');
 assert.ok(client.getQueryCache().find({queryKey:['invitation','pending']}));
 complete({companyName:'Preview'});
 assert.equal((await pending).companyName,'Preview');
 assert.equal(client.getQueryData(['invitation','pending']).companyName,'Preview');
 client.clear();
});
test('a stalled public request aborts at the deadline instead of loading forever',async()=>{
 let requestSignal;
 const {loadPublicAuth}=load((path,{signal})=>new Promise((resolve,reject)=>{requestSignal=signal;signal.addEventListener('abort',()=>reject(new Error('aborted')))}));
 await assert.rejects(loadPublicAuth('/auth/invitations/preview',new AbortController().signal,20),/연결이 지연/);
 assert.equal(requestSignal.aborted,true);
});
test('navigation cancellation reaches the request without becoming a timeout',async()=>{
 const parent=new AbortController();
 const {loadPublicAuth}=load((path,{signal})=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new Error('cancelled')))}));
 const pending=loadPublicAuth('/auth/invitations/preview',parent.signal,1000);
 parent.abort();
 await assert.rejects(pending,/cancelled/);
});
test('server errors are preserved so invalid links and connection errors can be distinguished',async()=>{
 const original=new Error('expired'); original.status=404;
 const {loadPublicAuth}=load(async()=>{throw original});
 await assert.rejects(loadPublicAuth('/auth/invitations/preview',new AbortController().signal,1000),error=>error===original);
});
