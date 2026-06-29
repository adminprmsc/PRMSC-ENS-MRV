import { WaterSystem } from './water-system.entity';
export declare class WaterSystemCalibrationCertificate {
    id: string;
    waterSystemId: string;
    fileUrl: string;
    uploadedAt: Date;
    expiryDate: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    waterSystem: WaterSystem;
}
