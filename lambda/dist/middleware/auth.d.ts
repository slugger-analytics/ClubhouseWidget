import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: {
                cognitoSub: string;
                username?: string;
                email?: string;
                [key: string]: any;
            };
        }
    }
}
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function optionalAuth(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map