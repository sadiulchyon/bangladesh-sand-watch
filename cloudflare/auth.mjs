const digest = value => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
async function matches(value, expected) {
  const [a,b] = await Promise.all([digest(value),digest(expected)]);
  const x=new Uint8Array(a),y=new Uint8Array(b); let diff=0;
  for(let i=0;i<x.length;i++) diff|=x[i]^y[i];
  return diff===0;
}
export async function authorized(request, env) {
  const header=request.headers.get('authorization')??'';
  if(env.INGEST_TOKEN && header.startsWith('Bearer ')) return matches(header.slice(7),env.INGEST_TOKEN);
  if(!env.OWNER_USERNAME || !env.OWNER_PASSWORD || !header.startsWith('Basic ')) return false;
  try { return await matches(atob(header.slice(6)),env.OWNER_USERNAME+':'+env.OWNER_PASSWORD); }
  catch { return false; }
}
export function denied() {
  return new Response('Sign in to Bangladesh Sand Watch',{status:401,headers:{'WWW-Authenticate':'Basic realm="Bangladesh Sand Watch", charset="UTF-8"','Cache-Control':'no-store'}});
}
