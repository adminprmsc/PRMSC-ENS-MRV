import { SetMetadata } from '@nestjs/common';

export const MIN_ROLE_KEY = 'min_role';

export const MinRole = (roleCode: string) =>
  SetMetadata(MIN_ROLE_KEY, roleCode);
