"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { supportsCustomAmount, validateProductAmountInput, normalizeProductAmount, resolveProductAmount } = require("../product-pricing");

test("variable pay-now products use the amount supplied by an API integration", () => {
 const product={payment_type:"pay_now",allow_custom_amount:true,amount:null};
 assert.equal(resolveProductAmount(product,125.5),125.5); assert.equal(resolveProductAmount(product,"300"),300);
});
test("fixed-price pay-now products ignore caller-supplied amounts", () => {
 const product={payment_type:"pay_now",allow_custom_amount:false,amount:75};
 assert.equal(resolveProductAmount(product,1),75); assert.equal(resolveProductAmount(product,9999),75);
});
test("custom donations keep caller-selected amount behavior", () => {
 const product={payment_type:"donate",allow_custom_amount:true,amount:null};
 assert.equal(resolveProductAmount(product,50),50); assert.equal(normalizeProductAmount("donate",true,undefined),null);
});
test("subscriptions cannot opt into caller-supplied amounts", () => {
 assert.equal(supportsCustomAmount("subscribe",true),false); assert.equal(resolveProductAmount({payment_type:"subscribe",allow_custom_amount:true,amount:300},1),300);
});
test("custom-price definitions may omit defaults but reject invalid amounts", () => {
 assert.equal(validateProductAmountInput("pay_now",true,null),true); assert.equal(validateProductAmountInput("pay_now",true,0),false); assert.equal(validateProductAmountInput("pay_now",true,"not money"),false); assert.equal(normalizeProductAmount("pay_now",true,undefined),null);
});
test("every payment still requires a positive finite amount", () => {
 const p={payment_type:"pay_now",allow_custom_amount:true,amount:null}; for(const amount of [undefined,null,"",0,-5,"abc",Infinity]){const n=resolveProductAmount(p,amount);assert.equal(Number.isFinite(n)&&n>0,false)} assert.equal(validateProductAmountInput("pay_now",false,0),false);
});
test("only pay-now and donation products can opt into custom amounts", () => {
 assert.equal(supportsCustomAmount("pay_now",true),true); assert.equal(supportsCustomAmount("donate",true),true); assert.equal(supportsCustomAmount("subscribe",true),false); assert.equal(supportsCustomAmount("unknown",true),false);
});
