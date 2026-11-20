export default {
  async fetch(request, env) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/query' || !env.SERVICE_KEY ||
        request.headers.get('Authorization') !== 'Bearer ' + env.SERVICE_KEY) return new Response(null,{status:404});
    try {
      const {sql,params} = await request.json();
      const result = await env.DB.prepare(sql).bind(...params).all();
      return Response.json(result,{headers:{'Cache-Control':'no-store'}});
    } catch { return Response.json({success:false},{status:400}); }
  }
};
