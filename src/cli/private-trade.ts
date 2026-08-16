import 'dotenv/config';
import { TradingService } from '../services/trading-service.js';
const args=process.argv.slice(2); const tokenIndex=args.indexOf('--preview-token'); const token=tokenIndex>=0?args[tokenIndex+1]:'';
if(!args.includes('--yes-i-understand')){console.error('برای اجرای واقعی باید --yes-i-understand را صریحاً اضافه کنید.');process.exit(2)}
if(!token){console.error('--preview-token لازم است.');process.exit(2)}
const svc=new TradingService(); svc.executePrivate(token).then(r=>{console.log(JSON.stringify(r,null,2))}).catch(e=>{console.error(e.message);process.exit(1)});
