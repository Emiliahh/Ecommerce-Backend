import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
export const password_validate = z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
        /^(?=.*[a-zA-Z])(?=.*\d).+$/,
        'Password must contain at least one letter and one number'
    );
export const registerSchema = z.object({
    email: z.string().email().describe('User\'s email address. Example: user@example.com'),
    phone: z.string().min(10).max(15).describe('User\'s phone number. Example: +1234567890'),
    // alphanumeric min 8 must contain number and text
    password: password_validate.describe('Must be at least 8 chars, alphanumeric with at least one letter and number. Example: Password123'),
});

export const changePasswordSchema = z.object({
    oldPassword: password_validate.describe('Your current password. Example: OldPassword123'),
    newPassword: password_validate.describe('Your new password. Must be at least 8 chars, alphanumeric with at least one letter and number. Example: NewPassword123'),
});
export class RegisterDto extends createZodDto(registerSchema) { }
export class ChangePasswordDto extends createZodDto(changePasswordSchema) { }
