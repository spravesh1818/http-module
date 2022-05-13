import { Token } from "../interfaces/token";
import { getDecodedToken } from "../utils/token";
import * as storage from "../utils/storage";
import { config } from "../config";
import { clear } from "./token.service";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../constants/storage.constants";

export function getUserData(): Token | null {
  try {
    const accessToken: string = storage.get(ACCESS_TOKEN);
    const decodedToken = getDecodedToken(accessToken);

    if (accessToken && decodedToken) {
      return decodedToken;
    }

    const refreshToken = storage.get(REFRESH_TOKEN);
    const decodedRefreshToken = getDecodedToken(refreshToken);

    if (refreshToken && decodedRefreshToken) {
      return decodedRefreshToken;
    }
  } catch (err) {
    return null;
  }

  return null;
}

/**
 * Log out of the system.
 *
 */
export async function logout() {
  clear();
  const url = `${config.authURI}${config.endpoints.auth.logout}`;
  window.location.href = url;
}
