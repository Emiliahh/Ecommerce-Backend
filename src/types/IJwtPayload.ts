export interface JwtPayload {
  /**
   * user id
   */
  sub: string;
  /**
   * user email
   */
  username: string;
}
