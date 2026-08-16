export type WatchRule={id:string;name:string;kind:'price_below'|'price_above'|'signal_score_above'|'signal_score_below';threshold:number;enabled:boolean;createdAt?:string};
export function evaluateWatchRules(rules:WatchRule[],input:{priceToman?:number;signalScore?:number}){
  return rules.filter(r=>r.enabled).map(rule=>{
    let value:number|undefined; let matched=false;
    if(rule.kind.startsWith('price_')) value=input.priceToman;
    else value=input.signalScore;
    if(value!=null){
      if(rule.kind==='price_below'||rule.kind==='signal_score_below') matched=value<rule.threshold;
      else matched=value>rule.threshold;
    }
    return {...rule,currentValue:value??null,matched};
  });
}
