import * as dotenv from "dotenv";
import { init } from "./app.js";
import store from "./store.js";
import keyLoader from "./keyLoader.js";

dotenv.config();

await store.createDb();
await keyLoader.loadKeyAndCertificate();

const port = process.env.APP_PORT;

const app = init();
app.listen(port, () => {
  console.log(`running on port: ${port}`);
});
