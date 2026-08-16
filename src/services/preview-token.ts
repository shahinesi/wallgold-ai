import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

const b64=(x:string)=>Buffer.from(x).toString('base64url');

function sign(payload:Record<string,unknown>){
  const body=b64(JSON.stringify(payload));
  const sig=createHmac('sha256',config.previewSigningSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token:string){
  const [body,sig]=token.split('.');
  if(!body||!sig) throw new Error('توکن امضاشده نامعتبر است.');
  const expected=createHmac('sha256',config.previewSigningSecret).update(body).digest('base64url');
  if(expected.length!==sig.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(sig))) throw new Error('امضای توکن معتبر نیست.');
  const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
  if(Date.now()>Number(p.expiresAtMs)) throw new Error('توکن منقضی شده است.');
  return p;
}

export function signPreview(payload:Record<string,unknown>){
  return sign({...payload,purpose:'trade_preview'});
}

export function verifyPreview(token:string){
  const p=verify(token);
  if(p?.purpose!=='trade_preview') throw new Error('این توکن برای پیش‌نمایش معامله صادر نشده است.');
  return p;
}

export function signAnalysis(decision:unknown){
  const now=Date.now();
  return sign({purpose:'market_analysis',decision,createdAtMs:now,expiresAtMs:now+config.analysisTokenTtlSeconds*1000});
}

export function verifyAnalysis(token:string){
  const p=verify(token);
  if(p?.purpose!=='market_analysis'||!p?.decision) throw new Error('این توکن برای تحلیل بازار معتبر نیست.');
  return p as {purpose:'market_analysis';decision:any;createdAtMs:number;expiresAtMs:number};
}
