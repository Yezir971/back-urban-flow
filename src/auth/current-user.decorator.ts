import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const getCurrentUserFromContext = (
  data: unknown,
  ctx: ExecutionContext,
) => {
  const request = ctx.switchToHttp().getRequest<{ user?: unknown }>();
  return request.user;
};

export const CurrentUser = createParamDecorator(getCurrentUserFromContext);
