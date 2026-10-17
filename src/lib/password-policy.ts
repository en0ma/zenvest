/** Registration and reset password policy, shared by server validators and client UX. */
export const passwordChecks = (value:string)=>[
 {label:"5–15 characters",passed:value.length>=5&&value.length<=15},
 {label:"One uppercase letter",passed:/[A-Z]/.test(value)},
 {label:"One number",passed:/[0-9]/.test(value)},
 {label:"One special character",passed:/[^A-Za-z0-9]/.test(value)}
];
export function isValidPassword(value:string){return value.length<=15&&passwordChecks(value).every(x=>x.passed)}
