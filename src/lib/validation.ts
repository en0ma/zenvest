import { z } from "zod";
import {isValidPassword} from "./password-policy.ts";
export const passwordSchema = z.string().min(5).max(15).refine(isValidPassword,"Use at least five characters, including one uppercase letter, one number, and one special character.");
export const registerSchema = z.object({
 name:z.string().min(2).max(9).regex(/^[A-Za-z0-9]+$/,"Display name must use letters and numbers only, with no spaces or symbols."),
 email:z.string().trim().toLowerCase().email().max(254),
 password:passwordSchema
}).strict();
