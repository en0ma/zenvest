import { z } from "zod";
import {isValidPassword} from "@/lib/password-policy";
export const passwordSchema = z.string().min(5).max(72).refine(isValidPassword,"Use at least five characters, including one uppercase letter, one number, and one special character.");
export const registerSchema = z.object({
 name:z.string().trim().min(2).max(120),
 email:z.string().trim().toLowerCase().email().max(254),
 password:passwordSchema
}).strict();
