import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { password_validate } from './register.dto';

export const loginSchema = z.object({
    username: z.email(),
    password: password_validate,
});

export class LoginDto extends createZodDto(loginSchema) { }
