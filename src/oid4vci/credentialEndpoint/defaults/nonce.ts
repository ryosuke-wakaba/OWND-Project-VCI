import { UpdateNonce } from "../types.js";
// import authStore, {
//   StoredAccessToken,
// } from "../../../../demos/common/src/authStore.js";
import { generateRandomString } from "../../../utils/randomStringUtils.js";

// TODO: Restore after design change - currently commented out to avoid demos/common/src dependency
export const updateNonce: UpdateNonce<any> = async (
  _storedAccessToken: any,
) => {
  const nonce = generateRandomString();
  const expiresIn = Number(process.env.VCI_ACCESS_TOKEN_C_NONCE_EXPIRES_IN);
  // await authStore.refreshNonce(storedAccessToken.id, nonce, expiresIn);
  return { nonce, expiresIn };
};
