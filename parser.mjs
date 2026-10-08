/* Lector de las tres hojas de iniciativas. Sin comunicaciones a servidores. */
export const clean = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g,' ').trim();
export const numeric = v => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v == null || typeof v === 'boolean') return null;
  let s = String(v).trim(); if (!s || /^[-–—]+$/.test(s)) return null;
  let negative = /^\s*[-−]/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[^\d.,]/g,''); if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g,'').replace(',','.') : s.replace(/,/g,'');
  else if (s.includes(',')) { const a=s.split(','); s = a.length===2 && a[1].length!==3 ? s.replace(',','.') : s.replace(/,/g,''); }
  const n = Number(s); return Number.isFinite(n) ? (negative ? -Math.abs(n) : n) : null;
};
export const txt = v => v == null ? '' : String(v).trim();
export const at = (r,c) => Array.isArray(r) ? r[c] : undefined;
const findSheet = (sheets,patterns) => Object.keys(sheets).find(n=>patterns.some(p=>p.test(clean(n)))) || null;
export function classifyPurchase(value){
  const s=clean(value);
  if(!s) return 'sin_info';
  const pending=/pendient|por comprar|sin comprar|no comprado|no colocar/.test(s);
  const stock=/\bstock\b|\binventario\b|\bexistencia\b/.test(s);
  const isOrder=/(\d{5,}|\b(?:oc|o\/c|pedido|orden)\s*[-#:]?\s*\d{2,})/.test(s) || (/^\d[\d\s.-]*$/.test(s) && s.replace(/\D/g,'').length>=3);
  if(pending && (stock || isOrder)) return 'revisar';
  if(pending) return 'pendiente';
  if(stock) return 'stock';
  if(isOrder) return 'colocada';
  return 'revisar';
}
const isHeader = r => /orden de compra/.test(clean(at(r,6))) && /partidas|item/.test(clean(r.join(' ')));
export function parsePurchases(rows){
  const h=rows.findIndex((r,i)=>i<35 && isHeader(r));
  if(h<0) return {rows:[],warnings:['No se reconoció el encabezado «Orden de compra» de la columna G.']};
  const out=[];
  for(let i=h+1;i<rows.length;i++){
    const r=rows[i]||[];
    if(isHeader(r)) continue;
    const part=txt(at(r,2)), item=txt(at(r,5)), oc=txt(at(r,6));
    if(!part && !item && !oc) continue;
    if(/^(total|control|observacion|tasa|flujo)/.test(clean(part))) continue;
    if(/^(total|control|observacion)/.test(clean(item))) continue;
    if(!item && !oc) continue;
    const amount=numeric(at(r,14)) ?? numeric(at(r,12));
    out.push({row:i+1,partida:part,item,oc,estado:classifyPurchase(oc),fecha:txt(at(r,7)),cantidad:numeric(at(r,8)),moneda:txt(at(r,9)),proveedor:txt(at(r,17)),presupuestoDOP:amount,presupuestoUSD:numeric(at(r,15)),netoDOP:numeric(at(r,12)),flujoDOP:numeric(at(r,33))});
  }
  return {rows:out,warnings:[]};
}
export function codeInfo(value){
  const m=txt(value).match(/^\s*(\d{1,3})(?:\.(\d{1,3}))?(?=\s|\b|$)/);
  if(!m) return null;
  const main=String(Number(m[1]));
  if(!m[2] || /^0+$/.test(m[2])) return {code:`${main}.00`,main,kind:'parent'};
  return {code:`${main}.${m[2]}`,main,kind:'child'};
}
const amount = (r,index) => numeric(at(r,index)) ?? 0;
const first = (rows,pattern,limit=35) => rows.findIndex((r,i)=>i<limit && pattern.test(clean((r||[]).join(' '))));
export function parseBudget(rows){
  const totalLine = first(rows,/total general estimado/);
  const summary = totalLine<0 ? null : {presupuesto:numeric(at(rows[totalLine],6)),real:numeric(at(rows[totalLine],7))};
  const summaryCategories=[];
  for(let i=0;i<Math.min(rows.length,22);i++){
    const r=rows[i]||[],label=txt(at(r,2));
    if(/^(equipamiento|edificacion|terreno|gasto|gastos)$/i.test(clean(label))){
      summaryCategories.push({label,presupuesto:amount(r,6),real:amount(r,7)});
    }
  }
  const headerStart=first(rows,/edificacion, instalaciones y equipamientos|edificacion instalaciones y equipamientos/);
  const start=headerStart<0?0:headerStart+1;
  const details=[]; const warnings=[];
  for(let i=start;i<rows.length;i++){
    const r=rows[i]||[], raw=txt(at(r,2));
    const parsed=codeInfo(raw);
    if(!parsed) continue;
    if(!raw.match(/^\s*\d{1,3}(?:\.\d{1,3})?(?=\s|$)/)) continue;
    details.push({...parsed,label:raw.replace(/^\s*\d{1,3}(?:\.\d{1,3})?\s*/, '').trim()||raw,presupuesto:amount(r,6),real:amount(r,7),row:i+1});
  }
  const groups = buildGroups(details);
  if(!groups.length) warnings.push('No se reconocieron las partidas financieras; revisa la estructura de la hoja.');
  const totals=summary && summary.presupuesto!=null && summary.real!=null ? {presupuesto:summary.presupuesto,real:summary.real,source:'total_general'} : {presupuesto:groups.reduce((s,g)=>s+g.presupuesto,0),real:groups.reduce((s,g)=>s+g.real,0),source:'partidas_sin_duplicar'};
  return {groups,totals,warnings,summary,summaryCategories};
}
function buildGroups(details){
  const result=[],map=new Map();
  for(const d of details){
    if(d.kind==='parent'){
      let g=map.get(d.main);
      if(!g){g={...d,children:[]};map.set(d.main,g);result.push(g);} else Object.assign(g,{...d,children:g.children});
    }else{
      let g=map.get(d.main);
      if(!g){g={code:`${d.main}.00`,main:d.main,kind:'parent',label:`Partida ${d.main}`,presupuesto:0,real:0,children:[],synthetic:true};map.set(d.main,g);result.push(g);}
      g.children.push({...d});
    }
  }
  for(const g of result){
    if(g.synthetic){g.presupuesto=g.children.reduce((s,c)=>s+c.presupuesto,0);g.real=g.children.reduce((s,c)=>s+c.real,0);}
    g.diferencia=g.presupuesto-g.real;
    g.children.forEach(c=>c.diferencia=c.presupuesto-c.real);
  }
  return result;
}
const MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const anyFooter = v => /^(total(?:es)?\b|control\b|tasa\b|flujo\b|conversion\b|cambio\b)/.test(clean(v));
export function parseCashflow(rows){
  let periodRow=-1;
  for(let i=0;i<Math.min(rows.length,20);i++){
    const count=(rows[i]||[]).filter(x=>/^p\s*\d+$/i.test(txt(x))).length;
    if(count>=2){periodRow=i;break;}
  }
  if(periodRow<0) return {groups:[],periods:[],totals:[],warnings:['No se encontraron las columnas P1, P2… del flujo de caja.']};
  const columns=[];
  for(let c=3;c<(rows[periodRow]||[]).length;c++){
    const match=txt(at(rows[periodRow],c)).match(/^p\s*(\d+)$/i);
    if(!match) continue;
    const id=Number(match[1]);
    let month='';
    for(let ri=periodRow-1;ri>=0 && ri>=periodRow-4;ri--){const v=txt(at(rows[ri],c));if(MONTHS.some(m=>clean(m)===clean(v))){month=v;break;}}
    if(!month) month=MONTHS[(id-1)%12];
    columns.push({id,col:c,month,yearIndex:Math.floor((id-1)/12)+1});
  }
  columns.sort((a,b)=>a.id-b.id);
  const warnings=[],details=[];let excluded=0;
  for(let i=periodRow+1;i<rows.length;i++){
    const r=rows[i]||[],label=txt(at(r,1)),code=txt(at(r,0));
    if(anyFooter(label)||anyFooter(code)){excluded++;continue;}
    const info=codeInfo(code) || codeInfo(label);
    if(!info) continue;
    const values=columns.map(p=>amount(r,p.col));
    details.push({...info,label:label.replace(/^\s*\d{1,3}(?:\.\d{1,3})?\s*/,'').trim()||label||info.code,presupuesto:amount(r,2),values,row:i+1});
  }
  const groups=[]; const map=new Map();
  for(const d of details){
    if(d.kind==='parent'){
      let g=map.get(d.main);
      if(!g){g={...d,children:[]};map.set(d.main,g);groups.push(g);} else Object.assign(g,{...d,children:g.children});
    } else {
      let g=map.get(d.main);
      if(!g){g={code:`${d.main}.00`,main:d.main,label:`Partida ${d.main}`,kind:'parent',children:[],values:columns.map(()=>0),presupuesto:0,synthetic:true};map.set(d.main,g);groups.push(g);}
      g.children.push(d);
    }
  }
  const totals=columns.map((_,ix)=>groups.reduce((acc,g)=>acc+(g.children.length?g.children.reduce((sub,c)=>sub+c.values[ix],0):g.values[ix]),0));
  groups.forEach(g=>{
    if(g.synthetic){g.presupuesto=g.children.reduce((s,c)=>s+c.presupuesto,0);g.values=columns.map((_,ix)=>g.children.reduce((s,c)=>s+c.values[ix],0));}
    g.detailTotals=columns.map((_,ix)=>g.children.length?g.children.reduce((s,c)=>s+c.values[ix],0):g.values[ix]);
    g.detailTotal=g.detailTotals.reduce((s,n)=>s+n,0);
    g.referenceTotal=g.values.reduce((s,n)=>s+n,0);
    g.unreconciled=g.children.length>0 && Math.abs(g.referenceTotal-g.detailTotal)>0.02;
  });
  if(groups.some(g=>g.unreconciled)) warnings.push('Algunos subtotales de origen difieren de la suma de sus detalles. El consolidado se calcula con detalle sin duplicar.');
  if(!groups.length) warnings.push('No se encontraron partidas reconocibles en Flujo de Caja.');
  let fxRate=null;
  for(const r of rows){
    const cells=r||[];
    const ix=cells.findIndex(v=>/^(?:tasa|tipo de cambio)\s*(?:usd|dolar|dolares)?$/i.test(clean(v)));
    if(ix<0)continue;
    fxRate=cells.slice(ix+1).map(numeric).find(x=>x!=null&&x>1&&x<1000)||null;
    if(fxRate)break;
  }
  return {groups,periods:columns.map(({id,month,yearIndex})=>({id,month,yearIndex})),totals,excluded,warnings,fxRate};
}
export function identifySheets(sheets){return {purchases:findSheet(sheets,[/bd.*plan.*detallado/,/plan detallado/,/bd.*compra/]),budget:findSheet(sheets,[/presupuesto.*real/,/presupuesto detallado/,/vs.*real/]),cashflow:findSheet(sheets,[/flujo.*caja/,/cash.*flow/])};}
export function parseProject(sheets,filename){
  const selected=identifySheets(sheets),warnings=[];
  const purchases=selected.purchases?parsePurchases(sheets[selected.purchases]):{rows:[],warnings:['Falta la hoja BD Plan Detallado.']};
  const budget=selected.budget?parseBudget(sheets[selected.budget]):{groups:[],totals:{presupuesto:0,real:0,source:'none'},warnings:['Falta la hoja Presupuesto Vs Real.']};
  const cashflow=selected.cashflow?parseCashflow(sheets[selected.cashflow]):{groups:[],periods:[],totals:[],warnings:['Falta la hoja Flujo de Caja.']};
  for(const w of [...purchases.warnings,...budget.warnings,...cashflow.warnings])warnings.push(w);
  return {name:filename.replace(/\.xlsx?$/i,'').replace(/[_-]/g,' ').trim(),filename,selected,purchases,budget,cashflow,warnings,importedAt:new Date().toISOString(),startYear:null,parserVersion:2};
}
export function aggregate(projects){
  const k={totalItems:0,colocada:0,stock:0,pendiente:0,sin_info:0,revisar:0,presupuesto:0,real:0,projectCount:projects.length};
  for(const p of projects){
    for(const r of p.purchases.rows){ k.totalItems++; k[r.estado]++; }
    k.presupuesto+=p.budget.totals.presupuesto||0;
    k.real+=p.budget.totals.real||0;
  }
  k.gestionadas=k.colocada+k.stock;
  k.avance=(k.totalItems-k.sin_info-k.revisar)>0?k.gestionadas/(k.totalItems-k.sin_info-k.revisar)*100:0;
  k.diferencia=k.presupuesto-k.real;
  return k;
}
export function periodLabel(period,year){return `${period.month.slice(0,3)} · ${year ? year + period.yearIndex-1 : 'Año '+period.yearIndex}`;}
