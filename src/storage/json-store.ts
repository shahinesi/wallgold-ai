import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { config } from '../config.js';
import { DEFAULT_POLICY, type TreasuryPolicy } from '../domain/types.js';

type Db={
  policy:TreasuryPolicy;
  watchRules:any[];
  shadowTrades:any[];
  audit:any[];
  analyses:any[];
  treasuryPlans:any[];
  marketSnapshots:any[];
};
const initial=():Db=>({policy:{...DEFAULT_POLICY},watchRules:[],shadowTrades:[],audit:[],analyses:[],treasuryPlans:[],marketSnapshots:[]});
const normalize=(x:any):Db=>({
  ...initial(),
  ...(x??{}),
  policy:{...DEFAULT_POLICY,...(x?.policy??{})},
  watchRules:Array.isArray(x?.watchRules)?x.watchRules:[],
  shadowTrades:Array.isArray(x?.shadowTrades)?x.shadowTrades:[],
  audit:Array.isArray(x?.audit)?x.audit:[],
  analyses:Array.isArray(x?.analyses)?x.analyses:[],
  treasuryPlans:Array.isArray(x?.treasuryPlans)?x.treasuryPlans:[],
  marketSnapshots:Array.isArray(x?.marketSnapshots)?x.marketSnapshots:[],
});
export class JsonStore{
  private file=join(config.dataDir,'state.json'); private queue=Promise.resolve();
  private async read():Promise<Db>{try{return normalize(JSON.parse(await readFile(this.file,'utf8')));}catch{return initial();}}
  private async write(db:Db){await mkdir(dirname(this.file),{recursive:true}); const t=`${this.file}.tmp`; await writeFile(t,JSON.stringify(db,null,2)); await rename(t,this.file);}
  private mutate(fn:(d:Db)=>void){this.queue=this.queue.then(async()=>{const d=await this.read(); fn(d); await this.write(d);}); return this.queue;}
  async getPolicy(){return (await this.read()).policy;}
  async setPolicy(p:TreasuryPolicy){await this.mutate(d=>{d.policy=p});return p;}
  async addAudit(x:any){await this.mutate(d=>{d.audit.push(x); d.audit=d.audit.slice(-1000)});}
  async listAudit(){return (await this.read()).audit;}
  async claimTradeAttempt(entry:any, limits:{maxDailyTrades:number;maxDailyNotionalToman:number}){
    let result:{claimed:boolean;reason?:string}={claimed:false};
    await this.mutate(d=>{
      const executionTypes=new Set(['trade_attempt','trade_submitted','trade','trade_ambiguous_or_failed','trade_reconciliation_failed']);
      if(d.audit.some((x:any)=>executionTypes.has(x?.type)&&x?.clientId===entry?.clientId)){
        result={claimed:false,reason:'این پیش‌نمایش قبلاً وارد مسیر اجرا شده است.'};return;
      }
      const since=Date.now()-24*60*60*1000;
      // Count one reservation per execution attempt. This avoids double-counting submitted/reconciled audit rows.
      const attempts=d.audit.filter((x:any)=>x?.type==='trade_attempt'&&Date.parse(x?.at)>=since);
      if(limits.maxDailyTrades>0&&attempts.length>=limits.maxDailyTrades){
        result={claimed:false,reason:'سقف تعداد معاملات ۲۴ ساعت اخیر در سیاست مدیریت ریسک پر شده است.'};return;
      }
      const notional=attempts.reduce((sum:number,x:any)=>sum+Number(x?.notionalToman??0),0);
      if(limits.maxDailyNotionalToman>0&&notional+Number(entry?.notionalToman??0)>limits.maxDailyNotionalToman){
        result={claimed:false,reason:'سقف ارزش معاملات ۲۴ ساعت اخیر در سیاست مدیریت ریسک رد می‌شود.'};return;
      }
      d.audit.push(entry);d.audit=d.audit.slice(-1000);result={claimed:true};
    });
    return result;
  }
  async addAnalysis(x:any){await this.mutate(d=>{d.analyses.push(x);d.analyses=d.analyses.slice(-300)});}
  async latestAnalysis(){return (await this.read()).analyses.at(-1)??null;}
  async listAnalyses(limit=100){const xs=(await this.read()).analyses;return xs.slice(-Math.max(1,Math.min(limit,300)));}
  async addWatchRule(x:any){await this.mutate(d=>d.watchRules.push(x));return x;}
  async listWatchRules(){return (await this.read()).watchRules;}
  async addShadowTrade(x:any){await this.mutate(d=>d.shadowTrades.push(x));return x;}
  async listShadowTrades(){return (await this.read()).shadowTrades;}
  async addTreasuryPlan(x:any){await this.mutate(d=>{d.treasuryPlans.push(x);d.treasuryPlans=d.treasuryPlans.slice(-300)});return x;}
  async listTreasuryPlans(){return (await this.read()).treasuryPlans;}
  async addMarketSnapshot(x:any){await this.mutate(d=>{d.marketSnapshots.push(x);d.marketSnapshots=d.marketSnapshots.slice(-10000)});return x;}
  async listMarketSnapshots(limit=500){const xs=(await this.read()).marketSnapshots;return xs.slice(-Math.max(1,Math.min(limit,10000)));}
}
export const store=new JsonStore();
