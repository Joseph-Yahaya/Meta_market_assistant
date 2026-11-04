// Explicit live check: uses Meta credits, fictional text only, never writes stock.
import assert from "node:assert/strict";
import {createMetaClient} from "../src/lib/meta-client.ts";
if(!process.env.MODEL_API_KEY?.trim()){
  console.error("Set MODEL_API_KEY privately before running this live check.");process.exit(1);
}
const client=createMetaClient({key:process.env.MODEL_API_KEY,baseUrl:process.env.META_API_BASE_URL,textModel:process.env.META_TEXT_MODEL});
const cases=[
  {name:"English sale with size and unit price",text:"Sold 3 packs of Indomie chicken noodles 70g at N250.50 per pack.",check:p=>{
    assert.equal(p.action,"sale");assert.equal(p.quantity,3);assert.equal(p.unit,"pack");assert.equal(Number(p.unitPriceNaira),250.5);assert.match(p.item,/indomie/i);assert.match(p.item,/70\s*g/i);assert.equal(p.needsClarification,false);
  }},
  {name:"Pidgin restock",text:"I don receive 6 packs of Peak milk powder 14g, na restock.",check:p=>{
    assert.equal(p.action,"restock");assert.equal(p.quantity,6);assert.equal(p.unit,"pack");assert.equal(p.unitPriceNaira,null);assert.match(p.item,/peak/i);assert.match(p.item,/14\s*g/i);assert.equal(p.needsClarification,false);
  }},
  {name:"Missing quantity requests clarification",text:"I sold some Indomie chicken noodles 70g.",check:p=>{
    assert.equal(p.quantity,null);assert.equal(p.needsClarification,true);assert.ok(p.question?.trim());
  }},
  {name:"Multiple items require one-item clarification",text:"Sold 2 packs of Indomie chicken noodles 70g and 3 packs of Peak milk powder 14g.",check:p=>{
    assert.equal(p.needsClarification,true);assert.ok(p.question?.trim());
  }},
];
let passed=0;
for(const c of cases){
  try{c.check(await client.extract(c.text));passed++;console.log(`PASS: ${c.name}`);}
  catch(error){console.error(`FAIL: ${c.name} (${error?.code||"EXTRACTION_ASSERTION_FAILED"}). No inventory changed.`);process.exitCode=1;break;}
}
console.log(`${passed}/${cases.length} live synthetic extraction checks passed. Provider response bodies and keys were not logged. This is not representative voice or dialect validation.`);
