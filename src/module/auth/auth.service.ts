import { ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { type DB, DRIZZLE } from '../../database/dizzle.provider';
import { eq } from 'drizzle-orm';
import { users, refresh_tokens } from 'src/database/schema';
import { hash, verify } from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { EnvConfig } from 'src/env.validation';
import UserDTO from 'src/common/dto/user.dto';
import { ChangePasswordDto} from './dto/register.dto';

@Injectable()
export class AuthService {
    constructor(
        @Inject(DRIZZLE) private readonly db: DB,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService<EnvConfig, true>,
    ) { }

    // allow phone or email
    async verifyUser(email: string, password: string) {
        const user = await this.db.query.users.findFirst({
            where: eq(users.email, email),
        });
        if (!user) {
            throw new NotFoundException('user not found')
        }
        const isPasswordValid = await verify(user.passwordHash!, password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('username or password is not correct')
        }
        return user
    }

    async register(email: string, phone: string, password: string) {
        // Check if user already exists
        const existingUser = await this.db.query.users.findFirst({
            where: eq(users.email, email),
        });
        if (existingUser) {
            throw new ConflictException('email already exists');
        }

        const passwordHash = await hash(password);
        const [newUser] = await this.db.insert(users).values({
            email,
            phone,
            passwordHash,
        }).returning();

        return this.generateTokens(newUser);
    }

    async login(user: any) {
        return this.generateTokens(user);
    }

    async refreshAccessToken(refreshToken: string) {
        let payload: any;
        try {
            payload = await this.jwtService.verifyAsync(refreshToken, {
                secret: this.configService.get('REFRESH_TOKEN_SECRET'),
            });
        } catch {
            throw new UnauthorizedException('invalid refresh token');
        }
        const tokenHash = this.hashToken(refreshToken);
        const storedToken = await this.db.query.refresh_tokens.findFirst({
            where: eq(refresh_tokens.tokenHash, tokenHash),
        });

        if (!storedToken || storedToken.revokedAt) {
            throw new UnauthorizedException('refresh token revoked or not found');
        }

        if (storedToken.expiresAt < new Date()) {
            throw new UnauthorizedException('refresh token expired');
        }

        // Issue new access token
        const accessPayload = { sub: payload.sub, username: payload.username };
        return {
            access_token: await this.jwtService.signAsync(accessPayload),
        };
    }

    async logout(refreshToken: string) {
        const tokenHash = this.hashToken(refreshToken);
        await this.db
            .update(refresh_tokens)
            .set({ revokedAt: new Date() })
            .where(eq(refresh_tokens.tokenHash, tokenHash));
    }
    async me(userid: string): Promise<UserDTO | null> {
        const user = await this.db.query.users.findFirst({
            where: eq(users.id, userid),
            columns: {
                id: true,
                email: true,
                phone: true,
                role: true,
                name: true,
                image: true,
            }
        });
        if (!user) {
            throw new NotFoundException('user not found')
        }
        return user;
    }
    async updatePassword(userid: string, dto: ChangePasswordDto) {
        const user = await this.db.query.users.findFirst({
            where: eq(users.id, userid),
        });
        if (!user) {
            throw new NotFoundException('user not found')
        }
        const isPasswordValid = await verify(user.passwordHash!, dto.oldPassword);
        if (!isPasswordValid) {
            throw new UnauthorizedException('username or password is not correct')
        }
        const passwordHash = await hash(dto.newPassword);
        await this.db.update(users).set({
            passwordHash,
        }).where(eq(users.id, userid));
    }

    private async generateTokens(user: any) {
        const payload = { sub: user.id, username: user.email, role: user.role };

        const access_token = await this.jwtService.signAsync(payload);

        const refresh_token = await this.jwtService.signAsync(payload, {
            secret: this.configService.get('REFRESH_TOKEN_SECRET'),
            expiresIn: this.configService.get('REFRESH_TOKEN_EXPIRES_IN'),
        });

        const tokenHash = this.hashToken(refresh_token);
        const expiresIn = this.configService.get('REFRESH_TOKEN_EXPIRES_IN');
        const expiresAt = this.calculateExpiry(expiresIn);

        await this.db.insert(refresh_tokens).values({
            userId: user.id,
            tokenHash,
            expiresAt,
        });

        return { access_token, refresh_token };
    }

    private hashToken(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }

    private calculateExpiry(expiresIn: string): Date {
        const match = expiresIn.match(/^(\d+)([smhd])$/);
        if (!match) {
            // Default 7 days
            return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }
        const value = parseInt(match[1]);
        const unit = match[2];
        const multipliers: Record<string, number> = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
        };
        return new Date(Date.now() + value * multipliers[unit]);
    }
}
