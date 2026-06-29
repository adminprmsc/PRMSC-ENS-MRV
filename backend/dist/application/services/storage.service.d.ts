import { ConfigService } from '@nestjs/config';
export declare class StorageService {
    private readonly config;
    constructor(config: ConfigService);
    private buildClient;
    private publicUrl;
    uploadFileStorage(file: Express.Multer.File, folder?: string): Promise<{
        bucket: string;
        object_key: string;
        public_url: string;
    }>;
    uploadFile(file: Express.Multer.File, folder?: string): Promise<{
        bucket: string;
        object_key: string;
        public_url: string;
    }>;
    tryDeletePublicObject(publicUrl: string | null | undefined): Promise<void>;
}
