import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness(){
 let now=0,cursor=0,frameId=0,position=900,present=true,fonts='loaded';const hooks=[],effects=[],frames=new Map(),scrolls=[],replacements=[],requests=[];
 const scroller={dataset:{dashboardLayoutReady:'true'},scrollHeight:2000,scrollTo:value=>scrolls.push({horizontal:value.left})};
 const row={getClientRects:()=>[{}],getBoundingClientRect:()=>({top:position-window.scrollY,height:60}),closest:()=>scroller,animate:()=>{}};
 const window={scrollY:0,scrollTo:value=>{scrolls.push(value);window.scrollY=value.top;}};
 const router={replace:(...args)=>replacements.push(args)};
 const requested=site=>requests.push(site);
 const react={useEffect:(fn,deps)=>{const i=cursor++,old=hooks[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))effects.push(()=>{old?.cleanup?.();hooks[i]={deps,cleanup:fn()};});}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/components/dashboard-scroll-to.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{
 exports,require:n=>n==='react'?react:{useRouter:()=>router,usePathname:()=>'/',useSearchParams:()=>new URLSearchParams('scrollTo=001&view=alerts&keep=1')},URLSearchParams,window,
 document:{getElementById:id=>present&&id==='site-grid-1'?row:null,querySelector:selector=>({getBoundingClientRect:()=>({height:selector==='.dashboard-sticky-columns'?64:56})}),fonts:{get status(){return fonts;}}},
 performance:{now:()=>now},requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id)
 });
 return {render(props={}){cursor=0;exports.default({onTargetRequested:requested,offset:80,...props});effects.splice(0).forEach(f=>f());},advance(ms){for(let t=0;t<ms;t+=20){now+=20;const batch=[...frames.values()];frames.clear();batch.forEach(f=>f());}},position:v=>position=v,present:v=>present=v,ready:v=>scroller.dataset.dashboardLayoutReady=String(v),fonts:v=>fonts=v,scrolls,replacements,requests,slug:exports.dashboardSiteSlug};
}
test('waits for final sorting and stable row position without repeatedly resetting the filter',()=>{
 const h=harness();h.render({ready:false});h.advance(200);assert.equal(h.scrolls.length,0);h.render({ready:true,layoutKey:'old'});h.advance(100);
 h.position(300);h.render({ready:true,layoutKey:'sorted'});h.advance(160);assert.equal(h.scrolls.length,0);h.advance(60);
 assert.equal(h.requests.length,1);assert.equal(h.scrolls[0].top,172);assert.equal(h.scrolls[0].behavior,'instant');assert.equal(h.replacements[0][0],'/?keep=1');
 h.render({ready:true,layoutKey:'sorted'});h.advance(500);assert.equal(h.replacements.length,1);
});
test('waits for measured columns, deferred row content and loaded fonts',()=>{
 const h=harness();h.ready(false);h.render();h.advance(400);assert.equal(h.replacements.length,0);
 h.ready(true);h.fonts('loading');h.advance(400);assert.equal(h.replacements.length,0);
 h.fonts('loaded');h.advance(240);assert.equal(h.replacements.length,1);
});
test('does not discard a hidden or unavailable hospital link',()=>{
 const h=harness();h.present(false);h.render();h.advance(11000);assert.equal(h.replacements.length,0);assert.equal(h.scrolls.length,0);
 h.present(true);h.render({layoutKey:'restored'});h.advance(240);assert.equal(h.replacements.length,1);
});
test('normalizes padded IDs while preserving nonnumeric hospital slugs',()=>{
 const h=harness();assert.equal(h.slug(' 001 '),'1');assert.equal(h.slug('000'),'0');assert.equal(h.slug('hospital-a'),'hospital-a');assert.equal(h.slug('0009007199254740993'),'9007199254740993');
});
