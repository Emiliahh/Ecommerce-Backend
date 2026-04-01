import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { password_validate } from './register.dto';

export const loginSchema = z.object({
    username: z.email(),
    password: password_validate,
});
export const responeSchema = z.object({
    access_token: z.string(),
})
export class LoginDto extends createZodDto(loginSchema) { }
export class LoginResponseDto extends createZodDto(responeSchema) { }
