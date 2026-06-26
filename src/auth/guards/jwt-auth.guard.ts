import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// Guard này được đăng ký global qua APP_GUARD trong AppModule
// → tự động chặn mọi request, yêu cầu phải có access token hợp lệ
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Reflector dùng để đọc metadata được gắn bởi decorator lên route/controller
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Kiểm tra route hiện tại có được đánh dấu @Public() không
    // getAllAndOverride: ưu tiên metadata của handler (method) trước, class (controller) sau
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Nếu có @Public() → bỏ qua, cho request đi thẳng vào controller
    if (isPublic) return true;

    // Không có @Public() → gọi AuthGuard('jwt') để xác thực access token
    // AuthGuard('jwt') sẽ kích hoạt JwtStrategy.validate() bên dưới
    return super.canActivate(context);
  }
}
