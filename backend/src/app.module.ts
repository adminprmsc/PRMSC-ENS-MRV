import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PresentationModule } from './presentation/presentation.module';

@Module({
  imports: [ConfigModule, PresentationModule],
})
export class AppModule {}
