import { Repository } from 'typeorm';
import { Submission } from '../../infrastructure/database/entities/submission.entity';
import { User } from '../../infrastructure/database/entities/user.entity';
import { VerificationLog } from '../../infrastructure/database/entities/verification-log.entity';
import { WaterEnergyLoggingDaily } from '../../infrastructure/database/entities/water-energy-logging-daily.entity';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import { OperatorHelpersService } from './operator-helpers.service';
import { WaterMeterVolumeService } from './water-meter-volume.service';
export declare class WaterSubmissionDetailService {
    private readonly submissionRepo;
    private readonly userRepo;
    private readonly waterLogRepo;
    private readonly waterSystemRepo;
    private readonly verificationLogRepo;
    private readonly operatorHelpers;
    private readonly waterMeterVolume;
    constructor(submissionRepo: Repository<Submission>, userRepo: Repository<User>, waterLogRepo: Repository<WaterEnergyLoggingDaily>, waterSystemRepo: Repository<WaterSystem>, verificationLogRepo: Repository<VerificationLog>, operatorHelpers: OperatorHelpersService, waterMeterVolume: WaterMeterVolumeService);
    buildWaterSubmissionDetailResponse(submission: Submission): Promise<{
        submission: {
            id: string;
            submission_type: string;
            status: string;
            operator_name: string;
            operator_email: string;
            submitted_at: string | null;
            reviewed_at: string | null;
            approved_at: string | null;
            reviewed_by_name: string | null;
            approved_by_name: string | null;
            remarks: string | null;
        };
        record_data: Record<string, unknown>;
        audit_trail: {
            action_type: string;
            performed_by: string;
            role: string;
            comment: string | null;
            created_at: string;
        }[];
    }>;
}
