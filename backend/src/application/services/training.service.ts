import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { unlink } from 'node:fs/promises';
import { Repository } from 'typeorm';
import {
  ADMIN,
  SUPER_ADMIN,
  SYSTEM_ADMIN,
  normalizeRoleCode,
} from '../../domain/constants/roles';
import { TrainingVideo } from '../../infrastructure/database/entities/training-video.entity';
import { StorageService } from './storage.service';

const TRAINING_VIDEO_VIEWER_ROLES = new Set([ADMIN, SUPER_ADMIN, SYSTEM_ADMIN]);

const TRAINING_VIDEO_ASSIGNABLE_AUDIENCES = new Set([ADMIN, SUPER_ADMIN]);

const DEFAULT_TRAINING_AUDIENCE = [ADMIN, SUPER_ADMIN];

const TRAINING_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const MAX_TRAINING_VIDEO_BYTES = 200 * 1024 * 1024;

function assertVideoViewer(role: string | undefined): void {
  const code = normalizeRoleCode(role);
  if (!code || !TRAINING_VIDEO_VIEWER_ROLES.has(code)) {
    throw new ForbiddenException({
      message:
        'Training videos are only available to portal users (Tehsil Manager, Manager Operations, Platform Administrator)',
    });
  }
}

function assertVideoPublisher(role: string | undefined): void {
  if (normalizeRoleCode(role) !== SYSTEM_ADMIN) {
    throw new ForbiddenException({
      message: 'Only Platform Administrator can publish training videos',
    });
  }
}

function normalizeVideoUrl(raw: string): string {
  const url = raw.trim();
  if (!url) {
    throw new BadRequestException({ message: 'Video URL is required' });
  }
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
}

function normalizeAudienceRoles(raw: string[] | undefined): string[] {
  const source = raw?.length ? raw : DEFAULT_TRAINING_AUDIENCE;
  const codes = [
    ...new Set(
      source
        .map((role) => normalizeRoleCode(role))
        .filter((role): role is string => Boolean(role)),
    ),
  ];
  const valid = codes.filter((code) =>
    TRAINING_VIDEO_ASSIGNABLE_AUDIENCES.has(code),
  );
  if (!valid.length) {
    throw new BadRequestException({
      message:
        'Select at least one audience: Tehsil Manager (ADMIN) or Manager Operations (SUPER_ADMIN)',
    });
  }
  return valid;
}

function audienceList(video: TrainingVideo): string[] {
  if (video.audienceRoles?.length) {
    return video.audienceRoles;
  }
  return [...DEFAULT_TRAINING_AUDIENCE];
}

function videoVisibleToRole(
  video: TrainingVideo,
  actorCode: string | null,
): boolean {
  if (!actorCode) {
    return false;
  }
  if (actorCode === SYSTEM_ADMIN) {
    return true;
  }
  return audienceList(video).includes(actorCode);
}

@Injectable()
export class TrainingService {
  constructor(
    @InjectRepository(TrainingVideo)
    private readonly videoRepo: Repository<TrainingVideo>,
    private readonly storageService: StorageService,
  ) {}

  private serialize(video: TrainingVideo) {
    return {
      id: String(video.id),
      title: video.title,
      description: video.description,
      youtube_url: video.youtubeUrl,
      sort_order: video.sortOrder,
      is_published: video.isPublished,
      audience_roles: audienceList(video),
      created_by_id: video.createdById,
      created_at: video.createdAt?.toISOString() ?? null,
      updated_at: video.updatedAt?.toISOString() ?? null,
    };
  }

  async listVideos(actorRole: string | undefined, includeUnpublished: boolean) {
    assertVideoViewer(actorRole);
    const actorCode = normalizeRoleCode(actorRole);
    const isPublisher = actorCode === SYSTEM_ADMIN;
    const showDrafts = includeUnpublished && isPublisher;

    let rows = await this.videoRepo.find({
      where: showDrafts ? {} : { isPublished: true },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });

    if (!showDrafts) {
      rows = rows.filter((video) => videoVisibleToRole(video, actorCode));
    }

    return { videos: rows.map((v) => this.serialize(v)) };
  }

  async uploadVideoFile(
    actorRole: string | undefined,
    file: Express.Multer.File | undefined,
  ) {
    assertVideoPublisher(actorRole);
    const hasDiskFile = Boolean(file?.path);
    const hasMemoryFile = Boolean(file?.buffer?.length);
    if (!file || (!hasDiskFile && !hasMemoryFile)) {
      throw new BadRequestException({ message: 'Video file is required' });
    }
    if (file.size > MAX_TRAINING_VIDEO_BYTES) {
      throw new BadRequestException({
        message: 'Video file is too large (max 200 MB)',
      });
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (!TRAINING_VIDEO_MIME_TYPES.has(mime)) {
      throw new BadRequestException({
        message: 'Only MP4, WebM, or MOV training videos are supported',
      });
    }

    try {
      const uploadResult = await this.storageService.uploadFile(
        file,
        'training-videos',
      );

      return {
        message: 'Training video uploaded',
        video_url: uploadResult.public_url,
        bucket: uploadResult.bucket,
        object_key: uploadResult.object_key,
      };
    } finally {
      if (file.path) {
        await unlink(file.path).catch(() => undefined);
      }
    }
  }

  async createVideo(
    actorRole: string | undefined,
    actorUserId: string,
    body: {
      title: string;
      description?: string | null;
      youtube_url: string;
      sort_order?: number;
      is_published?: boolean;
      audience_roles?: string[];
    },
  ) {
    assertVideoPublisher(actorRole);
    const video = this.videoRepo.create({
      title: body.title.trim(),
      description: body.description?.trim() || null,
      youtubeUrl: normalizeVideoUrl(body.youtube_url),
      sortOrder: body.sort_order ?? 0,
      isPublished: body.is_published ?? false,
      audienceRoles: normalizeAudienceRoles(body.audience_roles),
      createdById: actorUserId,
    });
    const saved = await this.videoRepo.save(video);
    return { message: 'Training video created', video: this.serialize(saved) };
  }

  async updateVideo(
    actorRole: string | undefined,
    videoId: string,
    body: {
      title?: string;
      description?: string | null;
      youtube_url?: string;
      sort_order?: number;
      is_published?: boolean;
      audience_roles?: string[];
    },
  ) {
    assertVideoPublisher(actorRole);
    const video = await this.videoRepo.findOne({ where: { id: videoId } });
    if (!video) {
      throw new NotFoundException({ message: 'Training video not found' });
    }
    if (body.title !== undefined) video.title = body.title.trim();
    if (body.description !== undefined) {
      video.description = body.description?.trim() || null;
    }
    if (body.youtube_url !== undefined) {
      const nextUrl = normalizeVideoUrl(body.youtube_url);
      if (nextUrl !== video.youtubeUrl) {
        await this.storageService.tryDeletePublicObject(video.youtubeUrl);
      }
      video.youtubeUrl = nextUrl;
    }
    if (body.sort_order !== undefined) video.sortOrder = body.sort_order;
    if (body.is_published !== undefined) video.isPublished = body.is_published;
    if (body.audience_roles !== undefined) {
      video.audienceRoles = normalizeAudienceRoles(body.audience_roles);
    }
    const saved = await this.videoRepo.save(video);
    return { message: 'Training video updated', video: this.serialize(saved) };
  }

  async deleteVideo(actorRole: string | undefined, videoId: string) {
    assertVideoPublisher(actorRole);
    const video = await this.videoRepo.findOne({ where: { id: videoId } });
    if (!video) {
      throw new NotFoundException({ message: 'Training video not found' });
    }
    await this.storageService.tryDeletePublicObject(video.youtubeUrl);
    await this.videoRepo.delete({ id: videoId });
    return { message: 'Training video deleted' };
  }
}
