/** Only the account's persisted default 2FA method is valid during login.
 * Never allow a login request to switch to another enabled method.
 */
export function loginDefaultTwoFactorMethod(config:{method:string;emailEnabled:boolean;secretEncrypted:string|null}):"EMAIL"|"APP"|null{
 if(config.method==="APP"&&config.secretEncrypted)return "APP";
 if(config.method==="EMAIL"&&config.emailEnabled)return "EMAIL";
 return null;
}
