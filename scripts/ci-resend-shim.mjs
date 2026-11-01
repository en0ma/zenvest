// Purely local Resend test double; never accesses an external network.
export const deliveries=[];
export let deliveryError=null;
export function setDeliveryError(value){deliveryError=value;}
export class Resend{
 constructor(key){if(!key)throw new Error("Missing fixture API key");}
 emails={send:async(payload)=>{deliveries.push(payload);return {error:deliveryError};}};
}
