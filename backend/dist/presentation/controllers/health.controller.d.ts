export declare class HealthController {
    index(): {
        status: string;
        version: string;
    };
    health(): {
        status: string;
    };
    hello(): {
        message: string;
    };
    corsTest(): {
        status: string;
        message: string;
    };
}
