import { createZodDto } from 'nestjs-zod';
import { paginateSchema } from 'src/common/dto/paginate.dto';
import { z } from 'zod';

export const getUsersQuerySchema = paginateSchema.extend({
  email: z.string().optional().describe('Filter by email'),
  name: z.string().optional().describe('Filter by name'),
  phone: z.string().optional().describe('Filter by phone'),
  role: z.enum(['customer', 'admin', 'superadmin']).optional().describe('Filter by role'),
});

export class GetUsersQueryDto extends createZodDto(getUsersQuerySchema) {}
