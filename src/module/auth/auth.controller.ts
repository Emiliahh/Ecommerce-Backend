import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { Public } from 'src/decorator/isPublic';
import { ChangePasswordDto, RegisterDto } from './dto/register.dto';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import UserDTO from 'src/common/dto/user.dto';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from 'src/env.validation';
import type { Request, Response } from 'express';
import { Roles } from 'src/decorator/role';
import { RoleGuard } from 'src/guard/role.guard';

const REFRESH_TOKEN_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private configService: ConfigService<EnvConfig, true>,
    ) { }

    @HttpCode(200)
    @Public()
    @UseGuards(LocalAuthGuard)
    @Post('login')
    @ApiOkResponse({ type: LoginResponseDto })
    async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const { access_token, refresh_token } = await this.authService.login(req.user);
        this.setRefreshTokenCookie(res, refresh_token);
        return { access_token };
    }

    @Public()
    @Post('register')
    async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
        const { access_token, refresh_token } = await this.authService.register(dto.email, dto.phone, dto.password);
        this.setRefreshTokenCookie(res, refresh_token);
        return { access_token };
    }

    @Public()
    @HttpCode(200)
    @Post('refresh')
    async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
        if (!refreshToken) {
            throw new UnauthorizedException('refresh token not found');
        }
        const { access_token } = await this.authService.refreshAccessToken(refreshToken);
        return { access_token };
    }

    @HttpCode(200)
    @Post('logout')
    async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
        if (refreshToken) {
            await this.authService.logout(refreshToken);
        }
        res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/auth' });
        return { message: 'logged out' };
    }

    @Get('me')
    @ApiBearerAuth()
    @ApiOkResponse({ type: UserDTO })
    async me(@Req() req: Request) {
        const user = req.user as any;
        return this.authService.me(user.userId);
    }
    @Get('test')
    @Roles('admin')
    @ApiBearerAuth()
    @UseGuards(RoleGuard)
    async test() {
        return {
            messsage: "yay",
        }
    }
    @Post('change-password')
    @ApiBearerAuth()
    async changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const user = req.user as any;
        await this.authService.updatePassword(user.userId, dto);
        return { message: 'password reset successfully' };
    }
    private setRefreshTokenCookie(res: Response, token: string) {
        const expiresIn = this.configService.get('REFRESH_TOKEN_EXPIRES_IN');
        const maxAge = this.parseExpiryToMs(expiresIn);

        res.cookie(REFRESH_TOKEN_COOKIE, token, {
            httpOnly: true,
            secure: this.configService.get('NODE_ENV') === 'production',
            sameSite: 'strict',
            path: '/api/auth',
            maxAge,
        });
    }


    private parseExpiryToMs(expiresIn: string): number {
        const match = expiresIn.match(/^(\d+)([smhd])$/);
        if (!match) return 7 * 24 * 60 * 60 * 1000;
        const value = parseInt(match[1]);
        const unit = match[2];
        const multipliers: Record<string, number> = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
        };
        return value * multipliers[unit];
    }
}
