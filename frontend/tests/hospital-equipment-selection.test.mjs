import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const assets=[
 {id:1,assetType:'MRI',name:'MRI 1',model:'Signa 1.5T',status:'ACTIVE'},
 {id:2,assetType:'MRI',name:'MRI 2',model:'Skyra 3T',serialNumber:'SN2',status:'ACTIVE'},
 {id:3,assetType:'MRI',name:'Old MRI',model:'Old',status:'REMOVED'},
 {id:4,assetType:'CHILLER',name:'Chiller',model:'C1',status:'ACTIVE'},
];
let queryOptions;
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/components/workspace/hospital-assets.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
 exports,require(name){
  if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  if(name==='@tanstack/react-query')return {useQuery:options=>{queryOptions=options;return {data:{assets},isPending:false};}};
  if(name.endsWith('auth-provider'))return {useAuth:()=>({session:{id:1}})};
  return {};
 }
});
function find(tree,type){
 if(Array.isArray(tree))return tree.flatMap(child=>find(child,type));
 if(!tree||typeof tree!=='object')return [];
 return [...(tree.type===type?[tree]:[]),...find(tree.props?.children,type)];
}
test('equipment uses the selected hospital query and hides inactive unselected devices and parts',()=>{
 const tree=exports.HospitalEquipmentSelection({siteId:'42',value:[],model:'',onChange(){}});
 assert.equal(queryOptions.queryKey[2],'42');
 assert.deepEqual(find(tree,'option').map(node=>node.props.value),['',1,2]);
 assert.equal(find(tree,'select')[0].props.disabled,false);
});
test('changing MRI preserves linked parts, replaces the old MRI and copies its model',()=>{
 let ids,model;
 const tree=exports.HospitalEquipmentSelection({siteId:'42',value:[1,4],model:'Signa 1.5T',onChange:(next,value)=>{ids=Array.from(next);model=value;}});
 const select=find(tree,'select')[0];assert.equal(select.props.value,'1');
 select.props.onChange({target:{value:'2'}});
 assert.deepEqual(ids,[4,2]);assert.equal(model,'Skyra 3T');
 select.props.onChange({target:{value:''}});assert.deepEqual(ids,[4]);assert.equal(model,'');
});
test('existing historical equipment and legacy free-text models remain readable',()=>{
 const old=exports.HospitalEquipmentSelection({siteId:'42',value:[3],model:'Old',onChange(){}});
 assert.ok(find(old,'option').some(node=>node.props.value===3));
 const legacy=exports.HospitalEquipmentSelection({siteId:'42',value:[],model:'Historical model',onChange(){}});
 assert.equal(find(legacy,'select')[0].props.value,'legacy');
 assert.ok(find(legacy,'option').some(node=>node.props.value==='legacy'));
});
test('hospital selection is required before equipment can be selected',()=>{
 const tree=exports.HospitalEquipmentSelection({siteId:'',value:[],model:'',onChange(){}});
 assert.equal(queryOptions.enabled,false);assert.equal(find(tree,'select')[0].props.disabled,true);
});
