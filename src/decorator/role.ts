import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { userRole } from 'src/database/schema';

export const ROLE_KEY = 'role';

export type UserRole = (typeof userRole.enumValues)[number];

export const Roles = (...role: UserRole[]) => {
  return applyDecorators(
    SetMetadata(ROLE_KEY, role),
    ApiBearerAuth(),
    ApiOperation({ summary: `Requires role: ${role.join(', ')}` }),
  );
};
