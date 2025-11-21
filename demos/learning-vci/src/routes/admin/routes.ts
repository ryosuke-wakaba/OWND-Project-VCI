import Koa from "koa";
import auth from "koa-basic-auth";
import { koaBody } from "koa-body";
import Router from "koa-router";

import routesHandler from "./routesHandler.js";
import commonAdminRoutes from "ownd-vci-common/dist/routes/admin/routes.js";
import { basicAuthOpts } from "ownd-vci-common/dist/routes/common.js";

const init = () => {
  const router = new Router();

  commonAdminRoutes.setupCommonRoute(router);

  // Learner Management UI Routes
  router.get(
    "/admin/learners",
    auth(basicAuthOpts()),
    async (ctx: Koa.Context) => {
      await routesHandler.handleLearnersList(ctx);
    },
  );

  router.get(
    "/admin/learners/new",
    auth(basicAuthOpts()),
    async (ctx: Koa.Context) => {
      await routesHandler.handleLearnerNewForm(ctx);
    },
  );

  router.post(
    "/admin/learners/new",
    auth(basicAuthOpts()),
    koaBody(),
    async (ctx: Koa.Context) => {
      await routesHandler.handleNewLearner(ctx);
    },
  );

  router.get(
    "/admin/learners/:id/edit",
    auth(basicAuthOpts()),
    async (ctx: Koa.Context) => {
      await routesHandler.handleLearnerEditForm(ctx);
    },
  );

  router.post(
    "/admin/learners/:id/update",
    auth(basicAuthOpts()),
    koaBody(),
    async (ctx: Koa.Context) => {
      await routesHandler.handleLearnerUpdate(ctx);
    },
  );

  router.delete(
    "/admin/learners/:id",
    auth(basicAuthOpts()),
    async (ctx: Koa.Context) => {
      await routesHandler.handleLearnerDelete(ctx);
    },
  );

  router.get(
    "/admin/learners/:learnerNo/offer",
    auth(basicAuthOpts()),
    async (ctx: Koa.Context) => {
      await routesHandler.handleLearnerCredentialOfferDisplay(ctx);
    },
  );

  router.post(
    "/admin/learners/:learnerNo/credential-offer",
    auth(basicAuthOpts()),
    koaBody(),
    async (ctx: Koa.Context) => {
      await routesHandler.handleLearnerCredentialOffer(ctx);
    },
  );

  return router;
};

export default init;
