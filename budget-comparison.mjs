/* Compara la misma partida entre proyectos, sin incluir subtotales en los totales. */
export function budgetComparison(projects){
  const groups=new Map();
  for(const p of projects){
    for(const g of p.budget?.groups||[]){
      if(!groups.has(g.code))groups.set(g.code,{code:g.code,label:g.label,projectGroups:new Map(),children:new Map()});
      const row=groups.get(g.code);
      if(!row.label||/^Partida \d+$/.test(row.label))row.label=g.label;
      row.projectGroups.set(p.id,g);
      for(const c of g.children||[]){
        if(!row.children.has(c.code))row.children.set(c.code,{code:c.code,label:c.label,values:new Map()});
        const sub=row.children.get(c.code);sub.values.set(p.id,c);
      }
    }
  }
  const order=(a,b)=>{const split=v=>v.split('.').map(Number);const x=split(a.code),y=split(b.code);return x[0]-y[0]||((x[1]||0)-(y[1]||0));};
  const rows=[...groups.values()].sort(order).map(g=>({...g,children:[...g.children.values()].sort(order)}));
  const totals=new Map(projects.map(p=>[p.id,{presupuesto:p.budget?.totals?.presupuesto||0,real:p.budget?.totals?.real||0}]));
  return {rows,totals};
}
