import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ReleaseNotesService } from '../../application/services/release-notes.service';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';

/** "What's new" — release notes, announcements and per-user read state. */
@Controller('api/releases')
@UseGuards(JwtAuthGuard)
export class ReleaseNotesController {
  constructor(private readonly releases: ReleaseNotesService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.releases.list(userId);
  }

  @Get('announcements')
  announcements(@CurrentUser() userId: string) {
    return this.releases.announcements(userId);
  }

  @Post(':id/read')
  @HttpCode(200)
  read(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.releases.markRead(userId, id);
  }

  @Post(':id/dismiss')
  @HttpCode(200)
  dismiss(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.releases.dismiss(userId, id);
  }
}
