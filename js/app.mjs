import {parseProject,aggregate,periodLabel,clean} from './parser.mjs';
import {budgetComparison} from './budget-comparison.mjs';
const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const USD=n=>Number.isFinite(n)?'US$ '+fmt(n):'—';
const DOP=n=>Number.isFinite(n)?'RD$ '+fmt(n):'—';
const signed=n=>n===0?'—':(n<0?'−':'')+fmt(Math.abs(n));
const pct=n=>fmt(Number(n)||0,1)+'%';
const cn=n=>n>0.005?'positive':n<-.005?'negative':'neutral';
const statusLabel={colocada:'Orden colocada',stock:'Completada / Stock',pendiente:'Pendiente de compra',sin_info:'Sin información',revisar:'Revisar estado'};
const statusColors={colocada:'#31869B',stock:'#03A1DD',pendiente:'#D89B38',sin_info:'#B3C9D1',revisar:'#bd6057'};
const views={resumen:['Resumen ejecutivo','Vista integral de compras, inversión y desembolsos programados.'],compras:['Seguimiento de compras','Órdenes colocadas, materiales en stock y pendientes por adquirir.'],presupuesto:['Presupuesto vs. Real','Desviaciones financieras por partida, con detalle jerárquico.'],flujo:['Flujo de caja','Desembolsos programados por período y partida, sin subtotales duplicados.'],comparativo:['Comparativo de proyectos','Analiza el avance y presupuesto de todas tus iniciativas.']};
let projects=[],view='resumen',selected='__all',search='',expandedBudget=new Set(),expandedCash=new Set(),expandedComparison=new Set(),modalOpen=false;
const DB='dashboard_iniciativas_v1', STORE='projects';
function openDatabase(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function useStore(mode,action){const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);let result;try{result=action(store);}catch(e){db.close();reject(e);return;}tx.oncomplete=()=>{db.close();resolve(result?.result)};tx.onerror=()=>{db.close();reject(tx.error)};});}
async function loadAll(){return new Promise(async(resolve,reject)=>{try{const db=await openDatabase(),tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();}catch(e){reject(e);}});}
async function saveProject(p){await useStore('readwrite',store=>store.put(p));}
async function deleteProject(id){await useStore('readwrite',store=>store.delete(id));}
const selectedProjects=()=>selected==='__all'?projects:projects.filter(p=>p.id===selected);
const selectedOne=()=>selected==='__all'?null:projects.find(p=>p.id===selected);
const txtMatch=(...args)=>!search||clean(args.join(' ')).includes(clean(search));
function toast(msg,bad=false){const el=$('toast');el.textContent=msg;el.style.background=bad?'#a34c45':'#19566D';el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,4200);}
function kpi(label,val,sub,icon){return `<article class="panel kpi"><div class="kpi-icon" aria-hidden="true">${icon}</div><p class="kpi-label">${label}</p><div class="kpi-value">${val}</div><div class="kpi-sub">${sub}</div></article>`;}
function panel(title,sub,inner,cls=''){return `<section class="panel chart-card ${cls}"><div class="panel-head"><div><h2 class="section-title">${title}</h2><p class="section-sub">${sub}</p></div></div>${inner}</section>`;}
function banner(msg,type=''){return `<div class="notice ${type}">${msg}</div>`;}
function emptySection(msg){return `<div style="color:#718994;text-align:center;padding:35px 10px;font-size:12px">${msg}</div>`;}
function coloredDifference(n,currency='USD'){return `<span class="${cn(n)}">${n===0?'—':(n<0?'−':'')+(currency==='DOP'?'RD$ ':'US$ ')+fmt(Math.abs(n))}</span>`;}
function renderUI(){
  $('pageTitle').textContent=views[view][0];$('pageSubtitle').textContent=views[view][1];$('crumb').textContent=views[view][0];
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $('projectCount').textContent=projects.length;
  const select=$('projectSelect'),opt=select.value;
  select.innerHTML=`<option value="__all">Todos los proyectos</option>`+projects.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');
  select.value=projects.some(p=>p.id===selected)?selected:'__all';
  const latest=projects.reduce((v,p)=>Math.max(v,new Date(p.importedAt||0).getTime()||0),0);
  $('lastUpdate').textContent=latest?`Última importación: ${new Date(latest).toLocaleDateString('es-DO')}`:'Sin archivos cargados';
  const list=selectedProjects(),notices=[];
  for(const p of list){if((p.parserVersion||1)<2)notices.push(`<strong>${escapeHtml(p.name)}</strong>• Vuelve a cargar este Excel para aplicar la nueva lectura de columnas G (presupuesto) y H (real).`);if(p.warnings?.length)notices.push(`<strong>${escapeHtml(p.name)}</strong>${p.warnings.map(w=>`• ${escapeHtml(w)}`).join('<br>')}`);}
  $('noticeArea').innerHTML=notices.length?banner(notices.join('<br><br>')):'';
  if(!projects.length){$('dashboardBody').innerHTML=emptyScreen();return;}
  if(view==='resumen')$('dashboardBody').innerHTML=renderSummary(list);
  if(view==='compras')$('dashboardBody').innerHTML=renderPurchases(list);
  if(view==='presupuesto')$('dashboardBody').innerHTML=renderBudget(list);
  if(view==='flujo')$('dashboardBody').innerHTML=renderFlow(list);
  if(view==='comparativo')$('dashboardBody').innerHTML=renderCompare();
  attachDynamicHandlers();
}
function emptyScreen(){return `<div class="empty"><div class="empty-icon">▤</div><h2>Tu portafolio comienza aquí</h2><p>Carga uno o varios archivos Excel de iniciativas. El dashboard identificará las hojas <strong>BD Plan Detallado</strong>, <strong>Presupuesto Vs Real</strong> y <strong>Flujo de Caja</strong>.</p><button class="btn primary" id="emptyUpload">＋ Seleccionar archivos Excel</button><p class="details">Admite .xlsx y .xls · Los proyectos quedan disponibles en este navegador · No publiques los archivos confidenciales en GitHub</p></div>`;}
function statusGraph(k){
  if(!k.totalItems)return emptySection('Sin registros en BD Plan Detallado.');
  const values=['colocada','stock','pendiente','sin_info','revisar'];let index=0,colors=[];
  for(const key of values){const percent=100*(k[key]||0)/k.totalItems;if(percent){colors.push(`${statusColors[key]} ${index.toFixed(3)}% ${(index+percent).toFixed(3)}%`);index+=percent;}}
  return `<div class="status-layout"><div class="donut" style="background:conic-gradient(${colors.join(',')})"><div class="donut-inner"><strong>${k.totalItems}</strong><span>ítems</span></div></div><div class="status-legend">${values.map(key=>`<div class="legend-row"><i class="swatch" style="background:${statusColors[key]}"></i><span>${statusLabel[key]}</span><strong>${k[key]||0}</strong></div>`).join('')}</div></div>`;
}
function budgetBars(groups){const max=Math.max(...groups.map(x=>Math.max(x.presupuesto||0,x.real||0)),1);return `<div class="bar-chart">${groups.slice(0,7).map(g=>`<div><div class="bar-row-label"><span>${escapeHtml(g.label)}</span><strong>${USD(g.real)}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,100*(g.real||0)/max)}%"></div></div><div class="bar-track" style="margin-top:4px;height:4px"><div class="bar-fill gold" style="width:${Math.max(0,100*(g.presupuesto||0)/max)}%"></div></div></div>`).join('')}</div><div class="legend" style="margin-top:16px"><span><i style="background:#31869B"></i>Real</span><span><i style="background:#7BC4D8"></i>Presupuestado</span></div>`;}
function rollupGroups(list){let g=[];for(const p of list)for(const part of p.budget.groups)g.push({...part,project:p.name,id:p.id+'_'+part.code});return g;}
function renderSummary(list){
  const a=aggregate(list),g=rollupGroups(list),flow=aggregatePeriods(list);
  const top=`<div class="grid-kpi">${kpi('Presupuesto total',USD(a.presupuesto),'Presupuesto vs. Real · USD','◈')}${kpi('Real registrado',USD(a.real),'Importe reportado como Real','▤')}${kpi('Diferencia presupuestaria',`<span class="${cn(a.diferencia)}">${USD(a.diferencia)}</span>`,'Presupuesto menos Real','↗')}${kpi('Avance de compras',pct(a.avance),`${a.gestionadas} gestionadas de ${a.totalItems-a.sin_info-a.revisar} clasificadas`,'✓')}</div>`;
  return top+`<div class="grid-2">${panel('Ejecución por partida','Comparación del monto real por partida; barras superiores = real.',g.length?budgetBars(g.filter(x=>txtMatch(x.label,x.project))):emptySection('No hay partidas en Presupuesto vs. Real.'))}${panel('Estado de las compras','Clasificación automática de la columna G.',statusGraph(a))}</div><div class="grid-2 equal">${panel('Flujo de caja programado','Consolidación de partidas de detalle; montos en DOP.',flowChart(flow,DOP))}${panel('Iniciativas en el portafolio','Presupuesto y avance registrado por proyecto.',projectCards(list))}</div>${list.length>0?banner('<strong>Criterio de totalización</strong>En Presupuesto vs. Real se prioriza el «TOTAL GENERAL ESTIMADO» de cada Excel. En Flujo de Caja se suman los detalles una sola vez; los subtotales y las filas inferiores de control no se agregan.','info'):''}`;
}
function projectCards(list){return `<div class="bar-chart">${list.map(p=>{const k=aggregate([p]);return `<div><div class="bar-row-label"><span title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span><strong>${pct(k.avance)}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${k.avance}%"></div></div><div class="subnote" style="margin-top:5px">${USD(k.presupuesto)} presupuestados · ${k.totalItems} ítems</div></div>`;}).join('')}</div>`;}
function purchaseRows(list){return list.flatMap(p=>p.purchases.rows.map(r=>({...r,project:p.name}))).filter(r=>txtMatch(r.item,r.partida,r.oc,r.proveedor,r.project,r.estado));}
function renderPurchases(list){
  const k=aggregate(list),rows=purchaseRows(list),pick=window.currentStatusFilter||'__all';
  const data=pick==='__all'?rows:rows.filter(r=>r.estado===pick);
  return `<div class="grid-kpi">${kpi('Ítems registrados',fmt(k.totalItems,0),'Total de registros reconocidos','≡')}${kpi('Órdenes colocadas',fmt(k.colocada,0),'Número válido en la columna G','✓')}${kpi('Completadas / Stock',fmt(k.stock,0),'Materiales existentes en stock','▣')}${kpi('Pendientes de compra',fmt(k.pendiente,0),'Identificados por texto en la columna G','◷')}</div><div class="grid-2 equal">${panel('Distribución de compras','Registros por estado.',statusGraph(k))}${panel('Avance gestionado', 'Órdenes colocadas + stock frente a registros clasificados.',`<div style="padding:20px 0"><div class="bar-row-label"><span>Gestionado</span><strong>${pct(k.avance)}</strong></div><div class="bar-track" style="height:18px"><div class="bar-fill" style="width:${k.avance}%"></div></div><p class="subnote">No se consideran «Sin información» o «Revisar» en el denominador hasta que se clasifiquen.</p></div>`)}</div><section class="panel table-panel"><div class="toolbar"><div><h2 class="section-title">Detalle de órdenes y materiales</h2><p class="section-sub">El listado se filtra con el proyecto y el buscador de la cabecera.</p></div><div class="small-actions"><select id="statusFilter" aria-label="Filtrar estado" class="outline-small"><option value="__all" ${pick==='__all'?'selected':''}>Todos los estados</option>${Object.keys(statusLabel).map(s=>`<option value="${s}" ${pick===s?'selected':''}>${statusLabel[s]}</option>`).join('')}</select><button class="outline-small" id="exportPurchases">Exportar CSV</button></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Iniciativa</th><th>Partida</th><th>Ítem</th><th>Orden de compra (G)</th><th>Estado</th><th>Proveedor</th><th class="num">Ppto. OI DOP*</th></tr></thead><tbody>${data.length?data.slice(0,1000).map(r=>`<tr><td>${escapeHtml(r.project)}</td><td>${escapeHtml(r.partida||'—')}</td><td>${escapeHtml(r.item||'—')}</td><td>${escapeHtml(r.oc||'—')}</td><td><span class="badge ${r.estado}">${statusLabel[r.estado]}</span></td><td>${escapeHtml(r.proveedor||'—')}</td><td class="num">${r.presupuestoDOP==null?'—':fmt(r.presupuestoDOP)}</td></tr>`).join(''):`<tr><td colspan="7" class="dim">No hay ítems para el filtro seleccionado.</td></tr>`}</tbody></table></div><p class="subnote">${data.length>1000?`Mostrando 1,000 de ${data.length} filas. Exporta CSV para ver todas. · `:''}*El monto es una referencia de las columnas de la hoja BD; puede repetirse por ítem y no se suma como presupuesto del proyecto.</p></section>`;
}
const budgetKey=(p,g)=>p.id+'|'+g.code;
const cashKey=(p,g)=>p.id+'|'+g.code;
function budgetTotals(list){const agg=aggregate(list);return `<div class="grid-kpi">${kpi('Presupuestado',USD(agg.presupuesto),'Total financiero en USD','◈')}${kpi('Real',USD(agg.real),'Reportado en la hoja financiera','▤')}${kpi('Diferencia',`<span class="${cn(agg.diferencia)}">${USD(agg.diferencia)}</span>`,'Presupuesto − Real','↗')}${kpi('Ejecución financiera',agg.presupuesto?pct(agg.real/agg.presupuesto*100):'—','Real / Presupuestado','◔')}</div>`;}
function renderBudget(list){
  if(list.length>1)return budgetTotals(list)+renderBudgetComparison(list);
  const rows=[];
  for(const p of list){for(const g of p.budget.groups){const key=budgetKey(p,g),isOpen=expandedBudget.has(key);if(!txtMatch(g.label,g.code,p.name,...g.children.map(x=>x.label)))continue;
    rows.push(`<tr class="parent"><td><button class="disclosure" data-budget-toggle="${escapeHtml(key)}"><span class="chev">${isOpen?'▼':'▶'}</span>${escapeHtml(g.code)} ${escapeHtml(g.label)}</button></td><td>${escapeHtml(p.name)}</td><td class="num">${fmt(g.presupuesto)}</td><td class="num">${fmt(g.real)}</td><td class="num">${coloredDifference(g.diferencia)}</td><td class="num">${g.presupuesto?pct(g.real/g.presupuesto*100):'—'}</td></tr>`);
    if(isOpen)for(const c of g.children.filter(c=>txtMatch(g.label,g.code,c.label,c.code,p.name)))rows.push(`<tr class="child"><td>${escapeHtml(c.code)} ${escapeHtml(c.label)}</td><td class="dim">${escapeHtml(p.name)}</td><td class="num">${fmt(c.presupuesto)}</td><td class="num">${fmt(c.real)}</td><td class="num">${coloredDifference(c.diferencia)}</td><td class="num">${c.presupuesto?pct(c.real/c.presupuesto*100):'—'}</td></tr>`);
  }}
  const t=aggregate(list);
  return budgetTotals(list)+`<section class="panel table-panel"><div class="toolbar"><div><h2 class="section-title">Matriz de partidas y subpartidas</h2><p class="section-sub">Pulsa ▶ para mostrar las subpartidas que pertenecen a cada partida principal.</p></div><div class="small-actions"><button id="expandBudget" class="outline-small">Expandir todo</button><button id="collapseBudget" class="outline-small">Contraer todo</button></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Partida / subpartida</th><th>Iniciativa</th><th class="num">Presupuestado USD</th><th class="num">Real USD</th><th class="num">Diferencia USD</th><th class="num">Real / Ppto.</th></tr></thead><tbody>${rows.length?rows.join(''):'<tr><td colspan="6">No hay partidas financieras.</td></tr>'}<tr class="grand"><td>TOTAL GENERAL</td><td>${list.length===1?escapeHtml(list[0].name):`${list.length} iniciativas`}</td><td class="num">${fmt(t.presupuesto)}</td><td class="num">${fmt(t.real)}</td><td class="num">${coloredDifference(t.diferencia)}</td><td class="num">${t.presupuesto?pct(t.real/t.presupuesto*100):'—'}</td></tr></tbody></table></div><p class="subnote">Los renglones 1.00, 2.00, etc. son subtotales visibles para navegar. <strong>No se suman otra vez con 1.01, 2.01…</strong> El total general de cada archivo se toma de «TOTAL GENERAL ESTIMADO» cuando existe. Diferencia = Presupuestado − Real.</p></section>`;
}
function renderBudgetComparison(list){
  const comparison=budgetComparison(list),rows=[];
  const cells=(value)=>value?`<td class="num">${fmt(value.presupuesto)}</td><td class="num">${fmt(value.real)}</td><td class="num">${coloredDifference(value.presupuesto-value.real)}</td>`:'<td class="num dim">—</td><td class="num dim">—</td><td class="num dim">—</td>';
  for(const g of comparison.rows){
    if(!txtMatch(g.code,g.label,...g.children.map(c=>c.label),...list.map(p=>p.name)))continue;
    const isOpen=expandedComparison.has(g.code);
    rows.push(`<tr class="parent"><td class="comparison-partida"><button class="disclosure" data-comparison-toggle="${escapeHtml(g.code)}" aria-expanded="${isOpen}"><span class="chev">${isOpen?'▼':'▶'}</span>${escapeHtml(g.code)} ${escapeHtml(g.label)}</button></td>${list.map(p=>cells(g.projectGroups.get(p.id))).join('')}</tr>`);
    if(isOpen)for(const c of g.children.filter(c=>txtMatch(g.code,g.label,c.code,c.label,...list.map(p=>p.name)))){
      rows.push(`<tr class="child"><td class="comparison-partida">${escapeHtml(c.code)} ${escapeHtml(c.label)}</td>${list.map(p=>cells(c.values.get(p.id))).join('')}</tr>`);
    }
  }
  const headers=list.map(p=>`<th colspan="3" class="project-col-title" scope="colgroup">${escapeHtml(p.name)}</th>`).join('');
  const subHeaders=list.map(()=>'<th class="num">Plan USD</th><th class="num">Real USD</th><th class="num">Diferencia USD</th>').join('');
  const totalCells=list.map(p=>cells(comparison.totals.get(p.id))).join('');
  return `<section class="panel table-panel budget-comparison-panel"><div class="toolbar"><div><h2 class="section-title">Plan vs. Real por partida · proyectos lado a lado</h2><p class="section-sub">Una fila por partida y tres columnas por proyecto. Abre ▶ para comparar subpartidas.</p></div><div class="small-actions"><button id="expandComparison" class="outline-small">Expandir todo</button><button id="collapseComparison" class="outline-small">Contraer todo</button><button id="exportComparison" class="outline-small">Exportar CSV</button></div></div><div class="table-scroll comparison-scroll"><table class="data-table comparison-table"><thead><tr><th rowspan="2" class="comparison-partida">Partida / subpartida</th>${headers}</tr><tr>${subHeaders}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${list.length*3+1}">No se encontraron partidas coincidentes con la búsqueda.</td></tr>`}<tr class="grand"><td class="comparison-partida">TOTAL GENERAL POR PROYECTO</td>${totalCells}</tr></tbody></table></div><p class="subnote">La diferencia es <strong>Plan − Real</strong>. Las partidas principales (1.00, 2.00…) ya representan subtotales: <strong>no se vuelven a sumar con sus subpartidas</strong>. El total general de cada proyecto proviene de su resumen oficial cuando está disponible. Desliza la tabla horizontalmente para consultar todos los proyectos.</p></section>`;
}
function aggregatePeriods(list){
  const map=new Map();
  for(const p of list){const flow=p.cashflow;flow.periods.forEach((period,i)=>{if(!map.has(period.id))map.set(period.id,{...period,value:0});map.get(period.id).value+=flow.totals[i]||0;});}
  return [...map.values()].sort((a,b)=>a.id-b.id);
}
function flowChart(data,formatter){
  if(!data.length)return emptySection('Carga una hoja Flujo de Caja para visualizar los pagos mensuales.');
  const width=760,height=215,left=52,top=15,bottom=36,right=13,plotHeight=height-top-bottom,plotWidth=width-left-right;
  const vals=data.map(d=>d.value),max=Math.max(1,...vals)*1.13,n=data.length;
  const x=i=>left+(n===1?plotWidth/2:i*plotWidth/(n-1)),y=v=>top+plotHeight-(v/max)*plotHeight;
  const ticks=[0,.25,.5,.75,1].map(t=>`<line x1="${left}" y1="${y(max*t)}" x2="${width-right}" y2="${y(max*t)}" class="chart-gridline"/><text x="${left-8}" y="${y(max*t)+3}" text-anchor="end" class="chart-axis">${max*t>=1000000?fmt(max*t/1000000,1)+'M':max*t>=1000?fmt(max*t/1000,0)+'K':fmt(max*t,0)}</text>`).join('');
  const points=data.map((d,i)=>`${x(i)},${y(d.value)}`).join(' '),area=`${x(0)},${top+plotHeight} ${points} ${x(n-1)},${top+plotHeight}`;
  const stride=n>18?3:n>12?2:1;
  const labels=data.map((d,i)=>i%stride===0?`<text x="${x(i)}" y="${height-10}" text-anchor="middle" class="chart-axis">P${d.id}</text>`:'').join('');
  return `<svg class="flow-chart" role="img" aria-label="Flujo de caja por período" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${ticks}<polygon points="${area}" class="chart-fill"/><polyline points="${points}" class="chart-line"/>${data.map((d,i)=>`<circle cx="${x(i)}" cy="${y(d.value)}" r="3.6" class="chart-dot"><title>P${d.id} · ${formatter(d.value)}</title></circle>`).join('')}${labels}</svg><p class="subnote">Cada período corresponde a P1, P2… (los años solo se muestran en la matriz si se configuran).</p>`;
}
function renderFlow(list){
  const periods=aggregatePeriods(list),total=periods.reduce((s,p)=>s+p.value,0),max=periods.reduce((a,b)=>a.value>b.value?a:b,{value:0}),budgetOI=list.reduce((s,p)=>s+p.cashflow.groups.reduce((ss,g)=>ss+(g.children.length?g.children.reduce((a,c)=>a+c.presupuesto,0):g.presupuesto),0),0);
  const tableRows=[];
  for(const p of list){const f=p.cashflow;for(const g of f.groups){const key=cashKey(p,g),opened=expandedCash.has(key),matches=txtMatch(g.label,g.code,p.name,...g.children.map(c=>c.label));if(!matches)continue;
    tableRows.push(`<tr class="parent"><td><button class="disclosure" data-cash-toggle="${escapeHtml(key)}"><span class="chev">${opened?'▼':'▶'}</span>${escapeHtml(g.code)} ${escapeHtml(g.label)}</button>${g.unreconciled?' <span title="El subtotal de origen no coincide con los detalles" class="flag">⚠</span>':''}</td><td>${escapeHtml(p.name)}</td><td class="num">${fmt(g.presupuesto)}</td>${periods.map(t=>{const i=f.periods.findIndex(x=>x.id===t.id),v=i<0?0:g.children.length?g.detailTotals[i]:g.values[i];return `<td class="num">${v?fmt(v):'—'}</td>`;}).join('')}<td class="num">${fmt(g.detailTotal)}</td></tr>`);
    if(opened)for(const c of g.children.filter(c=>txtMatch(g.label,g.code,c.label,c.code,p.name)))tableRows.push(`<tr class="child"><td>${escapeHtml(c.code)} ${escapeHtml(c.label)}</td><td class="dim">${escapeHtml(p.name)}</td><td class="num">${fmt(c.presupuesto)}</td>${periods.map(t=>{const i=f.periods.findIndex(x=>x.id===t.id),v=i<0?0:c.values[i];return `<td class="num">${v?fmt(v):'—'}</td>`;}).join('')}<td class="num">${fmt(c.values.reduce((s,x)=>s+x,0))}</td></tr>`);
  }}
  return `<div class="grid-kpi">${kpi('Flujo programado',DOP(total),'Suma del detalle por períodos','◈')}${kpi('Presupuesto OI',DOP(budgetOI),'Tomado de partidas de detalle','▤')}${kpi('Períodos',fmt(periods.length,0),'Columnas P1, P2… reconocidas','▦')}${kpi('Mayor desembolso',DOP(max.value),max.id?`Período P${max.id}`:'Sin períodos','↗')}</div>${panel('Curva de flujo de caja','Desembolsos programados en pesos dominicanos.',flowChart(periods,DOP))}<section class="panel table-panel" style="margin-top:18px"><div class="toolbar"><div><h2 class="section-title">Matriz mensual de flujo de caja</h2><p class="section-sub">Filas agrupadas por partida · desplázate horizontalmente para consultar todos los períodos.</p></div><div class="small-actions"><button id="expandCash" class="outline-small">Expandir todo</button><button id="collapseCash" class="outline-small">Contraer todo</button><button id="exportFlow" class="outline-small">Exportar CSV</button></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th style="min-width:220px">Partida / subpartida</th><th>Iniciativa</th><th class="num">Ppto. OI DOP</th>${periods.map(t=>`<th class="num">${escapeHtml(t.month.slice(0,3))}<br>P${t.id}<br>${getYearName(t,list)}</th>`).join('')}<th class="num">Total pagos DOP</th></tr></thead><tbody>${tableRows.length?tableRows.join(''):`<tr><td colspan="${periods.length+4}">No hay datos de Flujo de Caja.</td></tr>`}<tr class="grand"><td>GRAN TOTAL (SIN DUPLICAR)</td><td>${list.length===1?escapeHtml(list[0].name):`${list.length} iniciativas`}</td><td class="num">${fmt(budgetOI)}</td>${periods.map(t=>`<td class="num">${t.value?fmt(t.value):'—'}</td>`).join('')}<td class="num">${fmt(total)}</td></tr></tbody></table></div><p class="subnote"><strong>Excluidos del total:</strong> subtotales de partida (cuando hay detalle), «Total - DOP», «Control», «Tasa USD», «Flujo - USD» y controles inferiores. Los renglones principales muestran una vista del detalle. Las discrepancias entre subtotales originales y detalle se señalan con ⚠.</p></section>`;
}
function getYearName(t,list){if(list.length===1&&Number.isInteger(list[0].startYear))return list[0].startYear+t.yearIndex-1;return `Año ${t.yearIndex}`;}
function renderCompare(){
  const all=projects,k=aggregate(all),max=Math.max(1,...all.map(p=>p.budget.totals.presupuesto));
  return `<div class="grid-kpi">${kpi('Iniciativas',fmt(all.length,0),'Proyectos agregados','▦')}${kpi('Presupuesto total',USD(k.presupuesto),'Portafolio completo','◈')}${kpi('Real acumulado',USD(k.real),'Portafolio completo','▤')}${kpi('Diferencia global',`<span class="${cn(k.diferencia)}">${USD(k.diferencia)}</span>`,'Ppto. − Real','↗')}</div>${panel('Comparativo financiero','Barra clara: presupuesto; barra oscura: real.',`<div class="compare-chart">${all.map(p=>`<div class="compare-line"><label title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</label><div class="dual"><div class="primarybar" style="width:${100*(p.budget.totals.presupuesto||0)/max}%"></div><div class="realbar" style="width:${100*(p.budget.totals.real||0)/max}%"></div></div><strong>${USD(p.budget.totals.real)}</strong></div>`).join('')}</div>`)}<section class="panel table-panel" style="margin-top:18px"><div class="panel-head compact"><div><h2 class="section-title">Resumen por iniciativa</h2><p class="section-sub">Todas las iniciativas guardadas en este navegador.</p></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Iniciativa</th><th class="num">Presupuestado USD</th><th class="num">Real USD</th><th class="num">Diferencia USD</th><th class="num">Órdenes</th><th class="num">Stock</th><th class="num">Pendientes</th><th class="num">% avance</th></tr></thead><tbody>${all.map(p=>{const a=aggregate([p]);return `<tr><td><strong>${escapeHtml(p.name)}</strong></td><td class="num">${fmt(a.presupuesto)}</td><td class="num">${fmt(a.real)}</td><td class="num">${coloredDifference(a.diferencia)}</td><td class="num">${a.colocada}</td><td class="num">${a.stock}</td><td class="num">${a.pendiente}</td><td class="num">${pct(a.avance)}</td></tr>`;}).join('')}<tr class="grand"><td>TOTAL PORTAFOLIO</td><td class="num">${fmt(k.presupuesto)}</td><td class="num">${fmt(k.real)}</td><td class="num">${coloredDifference(k.diferencia)}</td><td class="num">${k.colocada}</td><td class="num">${k.stock}</td><td class="num">${k.pendiente}</td><td class="num">${pct(k.avance)}</td></tr></tbody></table></div></section>${all.length>1?`<div style="margin-top:18px">${renderBudgetComparison(all)}</div>`:''}`;
}
function attachDynamicHandlers(){
  $('emptyUpload')?.addEventListener('click',()=>$('fileInput').click());
  document.querySelectorAll('[data-budget-toggle]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.budgetToggle;expandedBudget.has(key)?expandedBudget.delete(key):expandedBudget.add(key);renderUI();}));
  document.querySelectorAll('[data-comparison-toggle]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.comparisonToggle;expandedComparison.has(key)?expandedComparison.delete(key):expandedComparison.add(key);renderUI();}));
  $('expandComparison')?.addEventListener('click',()=>{budgetComparison(view==='comparativo'?projects:selectedProjects()).rows.forEach(g=>expandedComparison.add(g.code));renderUI();});
  $('collapseComparison')?.addEventListener('click',()=>{expandedComparison.clear();renderUI();});
  $('exportComparison')?.addEventListener('click',()=>{const list=view==='comparativo'?projects:selectedProjects(),comp=budgetComparison(list),head=['Código','Partida',...list.flatMap(p=>[p.name+' Plan USD',p.name+' Real USD',p.name+' Diferencia USD'])],data=[];for(const g of comp.rows){data.push([g.code,g.label,...list.flatMap(p=>{const x=g.projectGroups.get(p.id);return x?[x.presupuesto,x.real,x.presupuesto-x.real]:['','',''];})]);for(const c of g.children)data.push([c.code,c.label,...list.flatMap(p=>{const x=c.values.get(p.id);return x?[x.presupuesto,x.real,x.presupuesto-x.real]:['','',''];})]);}data.push(['','TOTAL GENERAL',...list.flatMap(p=>{const x=comp.totals.get(p.id);return[x.presupuesto,x.real,x.presupuesto-x.real];})]);downloadCSV('comparativo_partidas_proyectos.csv',head,data);});
  document.querySelectorAll('[data-cash-toggle]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.cashToggle;expandedCash.has(key)?expandedCash.delete(key):expandedCash.add(key);renderUI();}));
  $('expandBudget')?.addEventListener('click',()=>{selectedProjects().forEach(p=>p.budget.groups.forEach(g=>expandedBudget.add(budgetKey(p,g))));renderUI();});
  $('collapseBudget')?.addEventListener('click',()=>{expandedBudget.clear();renderUI();});
  $('expandCash')?.addEventListener('click',()=>{selectedProjects().forEach(p=>p.cashflow.groups.forEach(g=>expandedCash.add(cashKey(p,g))));renderUI();});
  $('collapseCash')?.addEventListener('click',()=>{expandedCash.clear();renderUI();});
  $('statusFilter')?.addEventListener('change',e=>{window.currentStatusFilter=e.target.value;renderUI();});
  $('exportPurchases')?.addEventListener('click',()=>{const all=purchaseRows(selectedProjects()).filter(r=>!window.currentStatusFilter||window.currentStatusFilter==='__all'||r.estado===window.currentStatusFilter);downloadCSV('compras_iniciativas.csv',['Proyecto','Partida','Item','Orden de compra','Estado','Proveedor','Presupuesto DOP'],all.map(r=>[r.project,r.partida,r.item,r.oc,statusLabel[r.estado],r.proveedor,r.presupuestoDOP]));});
  $('exportFlow')?.addEventListener('click',()=>{const list=selectedProjects(),periods=aggregatePeriods(list);const records=list.flatMap(p=>p.cashflow.groups.flatMap(g=>{const lines=g.children.length?g.children:[g];return lines.map(c=>[p.name,c.code,c.label,c.presupuesto,...periods.map(t=>{const i=p.cashflow.periods.findIndex(x=>x.id===t.id);return i<0?0:c.values[i];})]);}));downloadCSV('flujo_iniciativas.csv',['Proyecto','Codigo','Partida','Presupuesto OI DOP',...periods.map(p=>'P'+p.id)],records);});
}
function downloadCSV(filename,headers,records){const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const content='\ufeff'+[headers,...records].map(r=>r.map(cell).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function modalToggle(open){modalOpen=open;$('modalBackdrop').hidden=!open;if(open)renderManager();}
function renderManager(){$('projectManager').innerHTML=projects.length?projects.map(p=>`<div class="manager-row" data-id="${escapeHtml(p.id)}"><div><label>Nombre de iniciativa</label><input class="manager-name" maxlength="100" value="${escapeHtml(p.name)}" aria-label="Nombre de ${escapeHtml(p.name)}"><small>${escapeHtml(p.filename)} · ${p.purchases.rows.length} ítems</small></div><div><label>Año inicial del flujo</label><input class="manager-year" placeholder="Sin definir" type="number" min="2000" max="2100" step="1" value="${p.startYear||''}"><small>Si no existe en el Excel</small></div><div class="small-actions"><button class="btn mini primary manager-save">Guardar</button><button class="danger-btn manager-delete" title="Eliminar">Eliminar</button></div></div>`).join(''):'<p class="muted">Aún no hay proyectos cargados.</p>';
  document.querySelectorAll('.manager-row').forEach(row=>{
    row.querySelector('.manager-save').addEventListener('click',async()=>{const p=projects.find(p=>p.id===row.dataset.id);if(!p)return;const name=row.querySelector('.manager-name').value.trim(),yearStr=row.querySelector('.manager-year').value.trim(),year=yearStr?Number(yearStr):null;if(!name){toast('Escribe un nombre para el proyecto.',true);return;}if(year!==null&&(!Number.isInteger(year)||year<2000||year>2100)){toast('Escribe un año entre 2000 y 2100.',true);return;}p.name=name;p.startYear=year;try{await saveProject(p);renderManager();renderUI();toast('Proyecto actualizado.');}catch(e){toast('No se pudo guardar: '+e.message,true);}});
    row.querySelector('.manager-delete').addEventListener('click',async()=>{const p=projects.find(p=>p.id===row.dataset.id);if(!p||!confirm(`¿Eliminar «${p.name}» de este navegador?`))return;try{await deleteProject(p.id);projects=projects.filter(x=>x.id!==p.id);if(selected===p.id)selected='__all';renderManager();renderUI();toast('Proyecto eliminado.');}catch(e){toast('No se pudo eliminar: '+e.message,true);}});
  });
}
async function ensureExcelLibrary(){if(window.XLSX)return true;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar el lector de Excel. Se necesita internet al abrir por primera vez.'));document.head.appendChild(s);});return !!window.XLSX;}
async function handleFiles(files){
  if(!files?.length)return;
  $('uploadBtn').disabled=true;$('uploadBtn').textContent='Procesando…';let completed=0;
  for(const file of files){
    try{
      if(!/\.xlsx?$/i.test(file.name))throw Error('Selecciona un archivo .xlsx o .xls.');
      if(file.size>40*1024*1024)throw Error('Archivo demasiado grande (límite 40 MB).');
      await ensureExcelLibrary();
      const buf=await file.arrayBuffer(),wb=window.XLSX.read(buf,{type:'array',cellDates:true,cellFormula:true});
      const sheets={};for(const name of wb.SheetNames){sheets[name]=window.XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:null,blankrows:true});}
      const result=parseProject(sheets,file.name);
      if(!result.selected.purchases&&!result.selected.budget&&!result.selected.cashflow)throw Error('No se encontró ninguna de las tres hojas esperadas.');
      const prev=projects.find(p=>p.filename.toLowerCase()===file.name.toLowerCase());
      if(prev&&!confirm(`Ya existe «${prev.name}». ¿Actualizarlo con el nuevo archivo?`))continue;
      result.id=prev?.id||('initiative_'+crypto.randomUUID());result.name=prev?.name||result.name;result.startYear=prev?.startYear||null;
      await saveProject(result);projects=projects.filter(p=>p.id!==result.id);projects.push(result);completed++;
    }catch(e){toast(`No se importó ${file.name}: ${e.message}`,true);console.error('Importación:',file.name,e);}
  }
  projects.sort((a,b)=>a.name.localeCompare(b.name,'es'));$('uploadBtn').disabled=false;$('uploadBtn').textContent='＋ Cargar Excel';$('fileInput').value='';renderUI();if(completed)toast(`${completed} ${completed===1?'iniciativa cargada':'iniciativas cargadas'} correctamente.`);
}
function bindShell(){
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;$('sidebar').classList.remove('open');renderUI();window.scrollTo({top:0,behavior:'smooth'});}));
  $('uploadBtn').addEventListener('click',()=>$('fileInput').click());$('fileInput').addEventListener('change',e=>handleFiles([...e.target.files]));
  $('projectSelect').addEventListener('change',e=>{selected=e.target.value;renderUI();});
  $('searchInput').addEventListener('input',e=>{search=e.target.value;renderUI();});
  $('printBtn').addEventListener('click',()=>window.print());
  $('manageBtn').addEventListener('click',()=>modalToggle(true));$('modalClose').addEventListener('click',()=>modalToggle(false));
  $('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))modalToggle(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modalOpen)modalToggle(false);});
  $('menuBtn').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
}
async function init(){bindShell();try{projects=await loadAll();projects.sort((a,b)=>a.name.localeCompare(b.name,'es'));}catch(err){console.error(err);toast('No se puede acceder al almacenamiento local. Revisa los permisos del navegador.',true);}renderUI();}
init();
