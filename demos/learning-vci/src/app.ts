import { fileURLToPath } from "url";
import path, { dirname } from "path";

import Koa from "koa";
import serve from "koa-static";
import render from "@koa/ejs";

import adminRoutes from "./routes/admin/routes.js";
import vciRoutes from "./routes/vci/routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename)
  .replace(/\/dist(\/.*)?$/, "")
  .replace(/\/src(\/.*)?$/, "");
console.log("file:", __filename);
console.log("dir:", __dirname);

export const init = () => {
  const app = new Koa();
  const adminRouter = adminRoutes();
  const vciRouter = vciRoutes();

  // Setup EJS template engine with layout support
  render(app, {
    root: path.join(__dirname, "views"),
    layout: "layout",
    viewExt: "ejs",
    cache: false,
  });

  app.use(serve(path.join(__dirname, "public")));

  app.use(adminRouter.routes()).use(adminRouter.allowedMethods());
  app.use(vciRouter.routes()).use(adminRouter.allowedMethods());
  app.use((ctx) => {
    ctx.response.status = 400;
  });
  return app;
};
