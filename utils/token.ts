import jwtDecode from "jwt-decode";
import { Token } from "../interfaces/token";
/**
 * Decoded the passed token and return decoded token.
 *
 * @param {jwtToken} token
 */
export function getDecodedToken(token: string): Token | null {
  try {
    return jwtDecode(token);
  } catch (error) {
    return null;
  }
}
