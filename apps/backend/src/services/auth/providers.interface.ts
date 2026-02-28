export interface ProvidersInterface {
  generateLink(query?: any): Promise<string> | string;
  getToken(code: string, redirectUri?: string): Promise<string>;
  getUser(
    providerToken: string
  ): Promise<{ email: string; id: string }> | false;
}
