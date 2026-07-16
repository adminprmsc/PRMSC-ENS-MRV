import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { extname } from 'node:path';
import { TrainingService } from '../../application/services/training.service';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../infrastructure/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import {
  CreateTrainingVideoDto,
  UpdateTrainingVideoDto,
} from '../dto/training.dto';

const TRAINING_VIDEO_UPLOAD_LIMIT = 200 * 1024 * 1024;

@Controller('api/training')
@UseGuards(JwtAuthGuard)
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get('videos')
  async listVideos(
    @CurrentUser('full') user: JwtPayload | undefined,
    @Query('include_unpublished') includeUnpublished?: string,
  ) {
    return this.trainingService.listVideos(
      user?.role,
      includeUnpublished === '1' || includeUnpublished === 'true',
    );
  }

  @Post('videos/upload')
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('file', {
      // Disk storage avoids loading ~200 MB videos into Node heap (which causes 500s).
      storage: diskStorage({
        destination: tmpdir(),
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').slice(0, 16);
          cb(null, `training-video-${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: TRAINING_VIDEO_UPLOAD_LIMIT },
    }),
  )
  async uploadVideo(
    @CurrentUser('full') user: JwtPayload | undefined,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.trainingService.uploadVideoFile(user?.role, file);
  }

  @Post('videos')
  @HttpCode(201)
  async createVideo(
    @CurrentUser('full') user: JwtPayload | undefined,
    @Body() body: CreateTrainingVideoDto,
  ) {
    return this.trainingService.createVideo(user?.role, user?.sub ?? '', body);
  }

  @Patch('videos/:id')
  async updateVideo(
    @CurrentUser('full') user: JwtPayload | undefined,
    @Param('id') id: string,
    @Body() body: UpdateTrainingVideoDto,
  ) {
    return this.trainingService.updateVideo(user?.role, id, body);
  }

  @Delete('videos/:id')
  async deleteVideo(
    @CurrentUser('full') user: JwtPayload | undefined,
    @Param('id') id: string,
  ) {
    return this.trainingService.deleteVideo(user?.role, id);
  }
}
