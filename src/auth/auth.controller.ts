import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { RequestWithSession } from './strategies/jwt-refresh.strategy';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './decorators/current-user.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { AuthDomainExceptionFilter } from './infrastructure/auth-domain-exception.filter';

// AuthModule không còn ném lỗi domain của UsersModule ra ngoài nữa — changePassword() dùng
// UserDirectory (port riêng của AuthModule) nên chỉ cần 1 filter.
@UseFilters(AuthDomainExceptionFilter)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public() // Bỏ qua JwtAuthGuard global (không cần access token)
  @UseGuards(JwtRefreshGuard) // Thay vào đó dùng JwtRefreshGuard — yêu cầu refresh token hợp lệ
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    // @CurrentUser() đọc req.user
    // Luồng: JwtRefreshGuard chạy → gọi JwtRefreshStrategy.validate()
    //        validate() tìm user trong DB, return danh tính rút gọn → Passport gắn vào req.user
    //        @CurrentUser() chỉ là shortcut lấy req.user ra thành param
    @CurrentUser() user: AuthenticatedUser,

    // @Req() inject toàn bộ Express Request object vào đây
    // JwtRefreshStrategy.validate() đã gắn thêm: (req as any).sessionId = payload.sid
    // sessionId là UUID của session đang được rotate (xóa cũ, tạo mới)
    @Req() req: RequestWithSession,
  ) {
    return this.authService.refreshTokens(user, req.sessionId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: LogoutDto) {
    return this.authService.logout(user.id, dto.refreshToken);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }
}
