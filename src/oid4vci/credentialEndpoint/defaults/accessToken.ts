import { AccessTokenStateProvider } from "../types.js";
// import authStore, {
//   StoredAccessToken,
// } from "../../../../demos/common/src/authStore.js";

// TODO: Restore after design change - currently commented out to avoid demos/common/src dependency
export const accessTokenStateProvider: AccessTokenStateProvider<any> = async (
  _accessToken: string,
) => {
  // const storedAccessToken = await authStore.getAccessToken(accessToken);
  // if (!storedAccessToken) {
  //   return { exists: false };
  // }
  // const { cNonce, cNonceExpiresIn, cNonceCreatedAt } = storedAccessToken;
  // const proofElements = storedAccessToken.authorizedCode.needsProof
  //   ? {
  //       cNonce: cNonce!,
  //       createdAt: cNonceCreatedAt!,
  //       expiresIn: cNonceExpiresIn!,
  //     }
  //   : undefined;
  // const payload = {
  //   authorizedCode: {
  //     code: storedAccessToken.authorizedCode.code,
  //     proofElements,
  //   },
  //   expiresIn: storedAccessToken.expiresIn,
  //   createdAt: new Date(storedAccessToken.createdAt),
  //   storedAccessToken,
  // };
  // return { exists: true, payload };
  return { exists: false };
};
