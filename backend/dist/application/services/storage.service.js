"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const node_crypto_1 = require("node:crypto");
const node_path_1 = require("node:path");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
function secureFilename(filename) {
    const base = (0, node_path_1.basename)(filename).replace(/[^\w.\-]+/g, '_');
    return base || 'file';
}
let StorageService = class StorageService {
    config;
    constructor(config) {
        this.config = config;
    }
    buildClient() {
        const accessKey = this.config.get('app.supabaseS3AccessKeyId');
        const secretKey = this.config.get('app.supabaseS3SecretAccessKey');
        const endpoint = this.config.get('app.supabaseS3Endpoint');
        const region = this.config.get('app.supabaseS3Region');
        if (!accessKey || !secretKey) {
            throw new Error('Supabase S3 credentials are missing in environment.');
        }
        if (!endpoint) {
            throw new Error('SUPABASE_S3_ENDPOINT is required.');
        }
        return new client_s3_1.S3Client({
            endpoint,
            region,
            credentials: {
                accessKeyId: accessKey,
                secretAccessKey: secretKey,
            },
            forcePathStyle: true,
        });
    }
    publicUrl(objectKey) {
        const bucket = this.config.get('app.supabaseStorageBucket');
        const publicBase = (this.config.get('app.supabaseStoragePublicBaseUrl') ?? '').replace(/\/+$/, '');
        if (!publicBase) {
            throw new Error('SUPABASE_STORAGE_PUBLIC_BASE_URL is missing.');
        }
        return `${publicBase}/${bucket}/${objectKey}`;
    }
    async uploadFileStorage(file, folder = 'uploads') {
        return this.uploadFile(file, folder);
    }
    async uploadFile(file, folder = 'uploads') {
        const bucket = this.config.get('app.supabaseStorageBucket');
        if (!bucket) {
            throw new Error('SUPABASE_STORAGE_BUCKET is required.');
        }
        const safeName = secureFilename(file.originalname || 'file');
        const now = new Date();
        const objectKey = `${folder.replace(/^\/+|\/+$/g, '')}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${(0, node_crypto_1.randomUUID)().replace(/-/g, '')}_${safeName}`;
        const client = this.buildClient();
        await client.send(new client_s3_1.PutObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            Body: file.buffer,
            ContentType: file.mimetype || undefined,
        }));
        return {
            bucket,
            object_key: objectKey,
            public_url: this.publicUrl(objectKey),
        };
    }
    async tryDeletePublicObject(publicUrl) {
        if (!publicUrl || typeof publicUrl !== 'string') {
            return;
        }
        const publicBase = (this.config.get('app.supabaseStoragePublicBaseUrl') ?? '').replace(/\/+$/, '');
        const bucket = this.config.get('app.supabaseStorageBucket');
        if (!publicBase || !bucket) {
            return;
        }
        const prefix = `${publicBase}/${bucket}/`;
        if (!publicUrl.startsWith(prefix)) {
            return;
        }
        const objectKey = publicUrl.slice(prefix.length).replace(/^\/+/, '');
        if (!objectKey) {
            return;
        }
        try {
            const client = this.buildClient();
            await client.send(new client_s3_1.DeleteObjectCommand({
                Bucket: bucket,
                Key: objectKey,
            }));
        }
        catch {
        }
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], StorageService);
//# sourceMappingURL=storage.service.js.map