import { createSelectSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { users, user_addresses } from 'src/database/schema';
import { IPaginatedRes } from 'src/types/IPaginatedRes';

const dateStringSchema = z.preprocess(
  (val) => (val instanceof Date ? val.toISOString() : val),
  z.string(),
);

// 1. Base User Schema (no password)
export const selectUserSchema = createSelectSchema(users)
  .omit({
    passwordHash: true,
    emailVerified: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    emailVerified: dateStringSchema.nullable().describe('Ngày xác thực email'),
    createdAt: dateStringSchema,
    updatedAt: dateStringSchema,
  });

export class UserResponseDto extends createZodDto(selectUserSchema) { }

// 2. Base Address Schema
export const selectAddressSchema = createSelectSchema(user_addresses);

export class AddressResponseDto extends createZodDto(selectAddressSchema) { }

// 3. User with Addresses Schema
export const userWithAddressesSchema = selectUserSchema.extend({
  addresses: z.array(selectAddressSchema).optional(),
});

export class UserWithAddressesResponseDto extends createZodDto(userWithAddressesSchema) { }

// 4. Paginated User Response
const paginatedUserResponseSchema: z.ZodType<IPaginatedRes<UserResponseDto>> = z.object({
  count: z.number(),
  data: z.array(selectUserSchema),
});

export class PaginatedUserResponseDto extends createZodDto(paginatedUserResponseSchema) { }

// 5. Message Response
export const messageResponseSchema = z.object({
  message: z.string(),
});

export class MessageResponseDto extends createZodDto(messageResponseSchema) { }
