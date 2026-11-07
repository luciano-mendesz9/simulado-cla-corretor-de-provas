import { z } from "zod";
export const name = z.string().trim().min(1, "Informe o nome.").max(80);
export const email = z.email().max(160).transform(value => value.trim().toLowerCase());
export const password = z.string().min(12, "A senha deve ter pelo menos 12 caracteres.").max(256);
export const classroomInput = z.strictObject({ name: z.string().trim().min(1).max(80) });
export const studentInput = z.strictObject({ firstName: name, lastName: name, classroomId: z.uuid() });
export const teacherCreateInput = z.strictObject({ firstName: name, lastName: name, email, password, status: z.enum(["ATIVO", "INATIVO"]).default("ATIVO") });
export const teacherUpdateInput = z.strictObject({ firstName: name, lastName: name, email, status: z.enum(["ATIVO", "INATIVO"]) });
