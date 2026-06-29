import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ApplicationModule } from '../../application/services/application.module';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MinRoleGuard } from './min-role.guard';
import { TehsilManagerGuard } from './tehsil-manager.guard';
import { TubewellUserGuard } from './tubewell-user.guard';

@Module({
  imports: [
    ApplicationModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwtSecretKey', 'jwt-dev-key'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    MinRoleGuard,
    TehsilManagerGuard,
    TubewellUserGuard,
  ],
  exports: [
    JwtModule,
    JwtAuthGuard,
    MinRoleGuard,
    TehsilManagerGuard,
    TubewellUserGuard,
    ApplicationModule,
  ],
})
export class AuthModule {}
