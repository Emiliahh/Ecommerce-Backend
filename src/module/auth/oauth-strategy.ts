import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Profile, Strategy, VerifyCallback } from "passport-google-oauth20";
import { EnvConfig } from "src/env.validation";

@Injectable()
export class GoogleOauthStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(private readonly configService: ConfigService<EnvConfig>) {
        super({
            clientID: configService.get('GOOGLE_CLIENT_ID')!,
            clientSecret: configService.get('GOOGLE_CLIENT_SECRET')!,
            callbackURL: configService.get('GOOGLE_CALLBACK_URL')!,
            scope: ['email', 'profile'], 
            passReqToCallback: true,
        });
    }

    async validate(
        request: any,
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback
    ): Promise<any> {
        const { id, name, emails, photos } = profile;
        const user = {
            provider: 'google',
            providerId: id,
            email: emails && emails.length > 0 ? emails[0].value : null,
            firstName: name?.givenName,
            lastName: name?.familyName,
            picture: photos && photos.length > 0 ? photos[0].value : null,
            accessToken,
            refreshToken,
        };
        done(null, user);
    }
}