import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// Danh tính rút gọn của người gọi — đúng những gì JWT payload mang theo (sub, username), không
// phải toàn bộ entity User. JwtStrategy/JwtRefreshStrategy gắn giá trị này vào req.user sau khi
// xác thực xong; @CurrentUser() chỉ là shortcut lấy req.user ra thành param.
export interface AuthenticatedUser {
  id: number;
  username: string;
}

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    return ctx.switchToHttp().getRequest<RequestWithUser>().user;
  },
);
