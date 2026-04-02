import { createInsertSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { user_addresses } from 'src/database/schema';

export const updateAddressSchema = createInsertSchema(user_addresses, {
}).omit({
  id: true,
  userId: true,
}).partial();

export class UpdateAddressDto extends createZodDto(updateAddressSchema) {}
