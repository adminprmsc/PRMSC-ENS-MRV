export declare function checkPasswordHash(storedHash: string, password: string): boolean;
export declare function generatePasswordHash(password: string, method?: string, saltLength?: number): string;
