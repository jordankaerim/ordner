import fs from "fs";
import p from "path";

async function w(dir, scope = [], routes = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const filePath = p.join(dir, item);
    const isIndex = item === "index.js";
    const isDir = fs.statSync(filePath).isDirectory();

    if (!isDir && !item.endsWith(".js")) {
      continue;
    }

    if (isDir) {
      await w(filePath, [...scope, item], routes);
      continue;
    }

    const name = isIndex ? "" : item.slice(0, -3);
    const path = "/" + [...scope, name].filter(Boolean).join("/");
    const exports = await import(p.join(process.cwd(), filePath));

    routes.push({ path, exports });
  }

  return routes;
}

const walk = async (dir) => {
  const routes = await w(dir);

  return routes.sort(({ path: a }, { path: b }) =>
    a < b ? -1 : a > b ? 1 : 0
  );
};

export default async function ordner(dir, polka, opts = {}) {
  const { logging = true, hook } = opts;

  const routes = await walk(dir);

  logging && console.log("");

  for (const { path, exports } of routes) {
    const array = Object.entries(exports);
    const methods = ["post", "get", "put", "patch", "del"];
    const handlers = array.filter(([key]) => methods.includes(key));

    handlers.sort(([a], [b]) =>
      methods.indexOf(a) < methods.indexOf(b) ? -1 : 1
    );

    const [, useBefore] = array.find(([key]) => key === "useBefore") || [];

    if (useBefore?.length) {
      logging && console.log(`   \x1b[33muse\x1b[0m ~> ${path}`);
      polka.use(path, ...useBefore);
    }

    for (const [method, handler] of handlers) {
      const useName = "useBefore" + method[0].toUpperCase() + method.slice(1);
      const [, useBeforeMethod] = array.find(([key]) => key === useName) || [];

      if (useBeforeMethod?.length) {
        logging && console.log(`   \x1b[33muse\x1b[0m ~> ${path}`);
        polka.use(path, ...useBeforeMethod);
      }

      logging &&
        console.log(
          `\x1b[36m${(method === "del" ? "delete" : method)
            .toUpperCase()
            .padStart(6)}\x1b[0m ~> ${path}`
        );

      polka[method === "del" ? "delete" : method](
        path,
        hook ? hook(handler) : handler
      );
    }
  }

  logging && console.log("");
}
