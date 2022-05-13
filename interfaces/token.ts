import { User } from "./user";

export interface Token {
  data: User;
  iat: number;
  exp: number;
}
