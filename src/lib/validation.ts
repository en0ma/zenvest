import { z } from "zod";
import {isValidPassword} from "./password-policy.ts";
export const passwordSchema = z.string().min(5).max(15).refine(isValidPassword,"Use at least five characters, including one uppercase letter, one number, and one special character.");
export const registerSchema = z.object({
 handle:z.string().min(1).max(8).regex(/^[a-z0-9]+$/,"Handle must be 1–8 lowercase letters or numbers, with no spaces or symbols."),
 email:z.string().trim().toLowerCase().email().max(254),
 password:passwordSchema
}).strict();
