import test from 'node:test';import assert from 'node:assert/strict';
import {classifyPurchase,parsePurchases,parseBudget,parseCashflow,aggregate,parseProject,identifySheets,numeric,codeInfo} from '../js/parser.mjs';
const row=(items={})=>{const r=Array(30).fill(null);Object.entries(items).forEach(([col,v])=>r[+col]=v);return r;};
test('columna G clasifica OC, stock, pendiente, ambiguos, vacío',()=>{
 assert.equal(classifyPurchase('4500993372'),'colocada');assert.equal(classifyPurchase('OC-12345'),'colocada');assert.equal(classifyPurchase('STOCK'),'stock');assert.equal(classifyPurchase('Pendiente de Compra'),'pendiente');assert.equal(classifyPurchase(''), 'sin_info');assert.equal(classifyPurchase('OC 9999 pendiente de compra'),'revisar');
});
test('parser de BD lee correctamente cabecera en fila 4',()=>{
 const rows=[row(),row(),row(),row({2:'Partidas',5:'Item',6:'Orden de compra'}),row({2:'1.01',5:'Silla',6:'Stock',14:1200}),row({2:'1.02',5:'Mesa',6:'Pendiente de compra',14:2400}),row({2:'1.03',5:'Tornillo',6:'4400099211',14:100})];
 const p=parsePurchases(rows);assert.equal(p.rows.length,3);assert.equal(p.rows[0].estado,'stock');assert.equal(p.rows[1].estado,'pendiente');assert.equal(p.rows[2].estado,'colocada');assert.equal(p.rows[0].presupuestoDOP,1200);
});
test('Presupuesto Vs Real ignora subtotales, mantiene gran total oficial y diferencia',()=>{
 const r=Array.from({length:36},()=>row());r[5]=row({2:'TOTAL GENERAL ESTIMADO',4:3466781.75,11:3084613.65});r[18]=row({2:'Edificación, Instalaciones y Equipamientos'});r[19]=row({2:'1.00 Estudios Preliminares',4:0,11:0});r[20]=row({2:'1.01 Diseño arquitectónico',4:0,11:0});r[29]=row({2:'2.00 Obra Civil',4:248337.27,11:259224.43});r[30]=row({2:'2.01 Edificación - Obra Civil',4:12458.73,11:17685.78});r[34]=row({2:'2.05 Instalaciones Sanitarias',4:25100,11:19376.54});
 const b=parseBudget(r);assert.equal(b.groups.length,2);assert.equal(b.groups[1].children.length,2);assert.ok(Math.abs(b.groups[1].diferencia + 10887.16) < 0.001);assert.equal(b.totals.presupuesto,3466781.75);assert.equal(b.totals.real,3084613.65);assert.equal(b.totals.source,'total_general');
});
test('Flujo excluye subtotales, total DOP, tasa y conversión USD',()=>{
 const r=Array.from({length:20},()=>row());r[3]=row({3:'Enero',4:'Febrero',5:'Marzo'});r[4]=row({0:'Part.',1:'Edificación',2:'Ppto OI',3:'P1',4:'P2',5:'P3'});
 r[5]=row({0:1,1:'1.00 Estudios Preliminares',2:3000,3:500,4:500,5:500});r[6]=row({0:'1.01',1:'1.01 Diseño arquitectónico',2:1000,3:100,4:200,5:300});r[7]=row({0:'1.02',1:'1.02 Diseño estructural',2:2000,3:200,4:0,5:200});r[8]=row({0:2,1:'2.00 Obra Civil',2:4000,3:100,4:100,5:100});r[9]=row({0:'2.01',1:'2.01 Construcción',2:4000,3:50,4:50,5:50});r[10]=row({1:'Total - DOP',3:999999,4:999999});r[11]=row({1:'Control=0',3:111111});r[12]=row({1:'Tasa USD',3:63});r[13]=row({1:'Flujo - USD',3:9999});
 const f=parseCashflow(r);assert.deepEqual(f.totals,[350,250,550]);assert.equal(f.groups.length,2);assert.equal(f.groups[0].children.length,2);assert.equal(f.excluded,4);assert.equal(f.groups[0].unreconciled,true);
});
test('parse multiple projects and aggregate statuses accurately',()=>{
 const purch=[row({2:'Partidas',5:'Item',6:'Orden de compra'}),row({2:'2.01',5:'Activo',6:'Pendiente de compra'}),row({2:'2.02',5:'Activo',6:'Stock'})];
 const bud=Array.from({length:23},()=>row());bud[5]=row({2:'TOTAL GENERAL ESTIMADO',4:200,11:120});bud[18]=row({2:'Edificación, Instalaciones y Equipamientos'});bud[19]=row({2:'2.00 Obra Civil',4:200,11:120});
 const project=parseProject({'BD Plan Detallado':purch,'Presupuesto Vs Real':bud},'Hispano.xlsx');
 assert.equal(project.name,'Hispano');assert.equal(project.selected.purchases,'BD Plan Detallado');
 const s=aggregate([project,project]);assert.equal(s.colocada,0);assert.equal(s.stock,2);assert.equal(s.pendiente,2);assert.equal(s.presupuesto,400);assert.equal(s.real,240);assert.equal(s.avance,50);
});
test('numeric with localized strings and code recognition',()=>{assert.equal(numeric('1,234.56'),1234.56);assert.equal(numeric('1.234,56'),1234.56);assert.equal(numeric('(1,240.50)'),-1240.5);assert.deepEqual(codeInfo('2.00 Obra Civil'),{code:'2.00',main:'2',kind:'parent'});assert.equal(codeInfo('2.01 Edificación').kind,'child');});
