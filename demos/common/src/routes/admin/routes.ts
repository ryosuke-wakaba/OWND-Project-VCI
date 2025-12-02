import Router from "koa-router";
import auth from "koa-basic-auth";
import { basicAuthOpts } from "../common.js";
import Koa from "koa";
import { koaBody } from "koa-body";
import {
  handleCsr,
  handleGetAllKeys,
  handleGetKey,
  handleImportKey,
  handleNewKey,
  handleRegisterCert,
  handleRevokeKey,
  handleSignLeafCert,
  handleSignSelfCert,
} from "./routesHandler.js";

const routeDefinitions = {
  get: {
    "/admin/api/keys": handleGetAllKeys,
    "/admin/api/keys/:kid": handleGetKey,
  },
  post: {
    "/admin/api/keys/new": handleNewKey,
    "/admin/api/keys/import": handleImportKey,
    "/admin/api/keys/:kid/revoke": handleRevokeKey,
    "/admin/api/keys/:kid/csr": handleCsr,
    "/admin/api/keys/:kid/signselfcert": handleSignSelfCert,
    "/admin/api/keys/:kid/signleafcert": handleSignLeafCert,
    "/admin/api/keys/:kid/registercert": handleRegisterCert,
  },
};
export const setupCommonRoute = (router: Router<any, {}>) => {
  const forGetMethod = routeDefinitions.get;
  const forPostMethod = routeDefinitions.post;
  for (const [path, handler] of Object.entries(forGetMethod)) {
    router.get(path, auth(basicAuthOpts()), async (ctx: Koa.Context) => {
      await handler(ctx);
    });
  }
  for (const [path, handler] of Object.entries(forPostMethod)) {
    router.post(
      path,
      auth(basicAuthOpts()),
      koaBody(),
      async (ctx: Koa.Context) => {
        await handler(ctx);
      },
    );
  }
};

export default {
  setupCommonRoute,
};
