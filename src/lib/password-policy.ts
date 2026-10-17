/** Registration and reset password policy, shared by server validators and client UX. */
export const passwordChecks = (value:string)=>[
 {label:"At least 5 characters",passed:value.length>=5},
 {label:"One uppercase letter",passed:/[A-Z]/.test(value)},
 {label:"One number",passed:/[0-9]/.test(value)},
 {label:"One special character",passed:/[^A-Za-z0-9]/.test(value)}
];
export function isValidPassword(value:string){return value.length<=72&&passwordChecks(value).every(x=>x.passed)}
