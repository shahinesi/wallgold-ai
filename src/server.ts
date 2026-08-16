import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { config } from './config.js';
import { createServer } from './mcp/create-server.js';

const loopbackHosts=new Set(['127.0.0.1','localhost','::1']);
const bindingIsLoopback=loopbackHosts.has(config.host);
if(!bindingIsLoopback&&!config.mcpSharedBearer&&!config.allowUnauthenticatedMcp){
  throw new Error('برای bind غیرلوکال، authentication لازم است. MCP_SHARED_BEARER را برای private single-user تنظیم کن یا OAuth 2.1 را برای multi-user پیاده‌سازی کن.');
}

const normalizeOrigin=(v:string)=>{try{return new URL(v).origin.toLowerCase();}catch{return ''}};
const allowedOrigins=new Set(config.allowedOrigins.map(normalizeOrigin).filter(Boolean));

const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'2mb'}));
app.get('/health',(_req,res)=>res.json({ok:true,service:'wallgold-copilot',tradeToolAdvertised:config.allowMcpTradeExecution}));

app.use('/mcp',(req,res,next)=>{
  const host=(req.hostname||'').toLowerCase();
  if(config.allowedHosts.length&&!config.allowedHosts.includes(host)) return res.status(403).json({error:'host_not_allowed'});

  const origin=req.headers.origin;
  if(origin&&allowedOrigins.size&&!allowedOrigins.has(normalizeOrigin(origin))) return res.status(403).json({error:'origin_not_allowed'});

  if(config.mcpSharedBearer){
    const auth=req.headers.authorization;
    if(auth!==`Bearer ${config.mcpSharedBearer}`) return res.status(401).json({error:'unauthorized'});
  } else if(!bindingIsLoopback&&!config.allowUnauthenticatedMcp){
    return res.status(401).json({error:'authentication_required'});
  }
  next();
});

app.all('/mcp',async(req,res)=>{
  try{
    const server=createServer();
    const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined});
    res.on('close',()=>{void transport.close();void server.close();});
    await server.connect(transport);
    await transport.handleRequest(req,res,req.body);
  }catch(e:any){
    console.error('MCP request failed',{name:e?.name??'Error',status:e?.status??null,errorCode:e?.errorCode??null});
    if(!res.headersSent)res.status(500).json({error:'mcp_error',message:'خطای داخلی MCP.'});
  }
});

app.listen(config.port,config.host,()=>console.log(`WallGold Copilot MCP: http://${config.host}:${config.port}/mcp`));
