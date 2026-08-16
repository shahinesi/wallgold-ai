export const WALLGOLD_CARD_URI='ui://wallgold/copilot-card-v1.html';

export const wallgoldCardHtml=String.raw`<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:light dark}
*{box-sizing:border-box}body{margin:0;padding:12px;background:transparent}.card{border:1px solid rgba(127,127,127,.25);border-radius:18px;padding:16px;background:rgba(127,127,127,.06)}
.head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}.title{font-size:18px;font-weight:800}.sub{opacity:.72;font-size:12px;margin-top:4px}.pill{border:1px solid rgba(127,127,127,.28);border-radius:999px;padding:6px 10px;font-weight:700;white-space:nowrap}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.item{padding:10px;border-radius:12px;background:rgba(127,127,127,.07)}.label{font-size:12px;opacity:.7}.value{font-weight:750;margin-top:3px}.section{margin-top:14px}.section h3{font-size:13px;margin:0 0 7px}.row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid rgba(127,127,127,.14)}.row:last-child{border-bottom:0}.good{color:#138a52}.bad{color:#c73b42}.neutral{color:#b07800}.muted{opacity:.7}.warn{margin-top:8px;padding:9px 10px;border-radius:10px;background:rgba(190,130,0,.12);font-size:12px}.empty{padding:16px;text-align:center;opacity:.7}@media(max-width:460px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body><div id="root" class="card"><div class="empty">در حال آماده‌سازی…</div></div>
<script>
(function(){
  var root=document.getElementById('root');
  var fa=function(n,d){return new Intl.NumberFormat('fa-IR',{maximumFractionDigits:d==null?2:d}).format(Number(n==null?0:n));};
  var el=function(tag,cls,text){var x=document.createElement(tag);if(cls)x.className=cls;if(text!=null)x.textContent=String(text);return x;};
  var clear=function(){while(root.firstChild)root.removeChild(root.firstChild);};
  var addHead=function(title,sub,pill,pillClass){var h=el('div','head');var a=el('div');a.appendChild(el('div','title',title));a.appendChild(el('div','sub',sub));h.appendChild(a);h.appendChild(el('div','pill '+(pillClass||''),pill));root.appendChild(h);};
  var addGrid=function(items){var g=el('div','grid');items.forEach(function(it){var box=el('div','item');box.appendChild(el('div','label',it[0]));box.appendChild(el('div','value '+(it[2]||''),it[1]));g.appendChild(box);});root.appendChild(g);};
  var section=function(title){var s=el('div','section');s.appendChild(el('h3','',title));root.appendChild(s);return s;};
  var row=function(parent,label,value,cls){var r=el('div','row');r.appendChild(el('span','',label));r.appendChild(el('strong',cls||'',value));parent.appendChild(r);};
  var warn=function(parent,text){parent.appendChild(el('div','warn',text));};
  var dirClass=function(d){return d==='bullish'?'good':d==='bearish'?'bad':'neutral';};
  var dirEmoji=function(d){return d==='bullish'?'🟢':d==='bearish'?'🔴':'🟡';};
  function analysis(d){
    clear(); addHead(d.signalFa||'تحلیل بازار طلا','تصمیم‌یار چندعاملی بازار طلا','اطمینان '+fa(d.confidence,0)+'٪','');
    addGrid([['امتیاز کلی',fa(d.score,1)+' از ۱۰۰',''],['پوشش داده',fa(d.coverage,0)+'٪',''],['سناریوی صعودی',fa(d.scenarioProbabilities&&d.scenarioProbabilities.up,0)+'٪','good'],['سناریوی نزولی',fa(d.scenarioProbabilities&&d.scenarioProbabilities.down,0)+'٪','bad']]);
    var c=section('مؤلفه‌های تصمیم');(d.components||[]).forEach(function(x){row(c,x.labelFa,dirEmoji(x.direction)+' '+x.directionFa,dirClass(x.direction));});
    if((d.warningsFa||[]).length){var w=section('هشدارها');d.warningsFa.forEach(function(x){warn(w,x);});}
  }
  function preview(d){
    var risk=d.risk||{}; clear(); addHead('پیش‌نمایش '+(d.sideFa||'معامله'),'هیچ سفارشی در این مرحله ثبت نشده است',risk.allowed?'مجاز':'مسدود',risk.allowed?'good':'bad');
    addGrid([['مبلغ تقریبی',fa(d.notionalToman,0)+' تومان',''],['مقدار طلا',fa(d.goldAmountGrams,3)+' گرم',''],['قیمت هر گرم',fa(d.pricePerGramToman,0)+' تومان',''],['اعتبار قیمت',d.quoteTtlSeconds==null?'—':fa(d.quoteTtlSeconds,0)+' ثانیه',''],['سهم طلا بعد از اقدام',fa(d.after&&d.after.goldAllocationPct,2)+'٪','']]);
    var s=section('اثر روی موجودی');row(s,'نقد کل',fa(d.before&&d.before.cashToman,0)+' ← '+fa(d.after&&d.after.cashToman,0)+' تومان');row(s,'نقد قابل‌استفاده',fa(d.before&&d.before.availableCashToman,0)+' ← '+fa(d.after&&d.after.availableCashToman,0)+' تومان');row(s,'طلای کل',fa(d.before&&d.before.goldGrams,3)+' ← '+fa(d.after&&d.after.goldGrams,3)+' گرم');row(s,'طلای قابل‌استفاده',fa(d.before&&d.before.availableGoldGrams,3)+' ← '+fa(d.after&&d.after.availableGoldGrams,3)+' گرم');
    (risk.blocks||[]).forEach(function(x){warn(root,x);});
  }
  function treasury(d){
    var p=(d.portfolio&&d.portfolio.portfolio)||d.portfolio||{};clear();addHead('خزانه طلا','نمای یکپارچه دارایی و سیاست ریسک','سهم طلا '+(p.goldAllocationPct==null?'—':fa(p.goldAllocationPct,2)+'٪'),'');
    addGrid([['نقد کل',fa(p.cashToman,0)+' تومان',''],['نقد قابل‌استفاده',fa(p.availableCashToman,0)+' تومان',''],['طلای کل',fa(p.goldGrams,3)+' گرم',''],['طلای قابل‌استفاده',fa(p.availableGoldGrams,3)+' گرم',''],['ارزش طلا',p.goldValueToman==null?'—':fa(p.goldValueToman,0)+' تومان',''],['ارزش کل',p.totalValueToman==null?'—':fa(p.totalValueToman,0)+' تومان','']]);
  }
  function render(payload){var x=payload&&payload.data!=null?payload.data:payload;if(payload&&payload.kind==='analysis')analysis(x);else if(payload&&payload.kind==='preview')preview(x);else if(payload&&payload.kind==='treasury')treasury(x);else{clear();root.appendChild(el('div','empty','داده قابل نمایش دریافت نشد.'));}}
  window.addEventListener('message',function(e){if(e.source!==window.parent)return;var m=e.data;if(!m||m.jsonrpc!=='2.0')return;if(m.method==='ui/notifications/tool-result')render(m.params&&m.params.structuredContent);},{passive:true});
})();
</script></body></html>`;
