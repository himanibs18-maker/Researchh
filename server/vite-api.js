import fs from "node:fs";
export function localApi(env) {
  return {
    name: "research-local-api",
    configureServer(server) {
      const deployed =
        JSON.parse(fs.readFileSync("vercel.json", "utf8")).env || {};
      for (const [k, v] of Object.entries({ ...deployed, ...env }))
        if (!process.env[k] && typeof v === "string") process.env[k] = v;
      server.middlewares.use("/api", async (req, res, next) => {
        const u = new URL(req.url, "http://localhost"),
          route = u.pathname.slice(1);
        if (
          ![
            "reports",
            "process",
            "bookmarks",
            "library",
            "profile",
            "guest",
          ].includes(route)
        )
          return next();
        try {
          req.query = Object.fromEntries(u.searchParams);
          if (["POST", "PUT", "DELETE"].includes(req.method)) {
            let body = "";
            for await (const chunk of req) {
              body += chunk;
              if (body.length > 4350000) {
                res.statusCode = 413;
                res.end('{"error":"File exceeds upload limit."}');
                return;
              }
            }
            req.body = body ? JSON.parse(body) : {};
          }
          res.status = (n) => {
            res.statusCode = n;
            return res;
          };
          res.json = (data) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
            return res;
          };
          const { default: handler } = await import(`../api/${route}.js`);
          await handler(req, res);
        } catch {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end('{"error":"The local research service is unavailable."}');
        }
      });
    },
  };
}
