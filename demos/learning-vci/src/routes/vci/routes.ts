import Router from "koa-router";

import commonVciRoutes from "ownd-vci-common/dist/routes/vci/routes.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

import { tokenConfigure } from "../../logic/vciConfigProvider.js";
import { configure } from "../../logic/credentialsConfigProvider.js";
import { nonceConfigure } from "../../logic/nonceConfigProvider.js";
import { MetadataRepository } from "../../metadata/MetadataRepository.js";
import { getLastMatchedCertName } from "../../logic/x5cValidator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename).split("/src")[0];

const init = () => {
  const router = new Router();

  const credentialIssuer =
    process.env.CREDENTIAL_ISSUER || "http://localhost:3000";

  const metadataRepository = new MetadataRepository(credentialIssuer);

  commonVciRoutes.setupCommonRoute(
    router,
    tokenConfigure,
    configure,
    nonceConfigure,
    metadataRepository,
    __dirname,
    ["en-US", "ja-JP"],
    "ja-JP",
    { getMatchedCertName: getLastMatchedCertName },
  );

  return router;
};

export default init;
