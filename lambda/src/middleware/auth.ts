import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

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

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-2_tG7IQQ6G7';
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || '';

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: USER_POOL_ID,
      tokenUse: 'access',
      clientId: CLIENT_ID || null,
    });
  }
  return verifier;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Try to get token from cookie first, then Authorization header
  const cookieToken = req.cookies?.accessToken;
  const headerToken = req.headers.authorization?.split(' ')[1];
  const token = cookieToken || headerToken;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  try {
    const payload = await getVerifier().verify(token);
    req.user = {
      cognitoSub: payload.sub,
      username: payload.username as string | undefined,
      email: payload.email as string | undefined,
    };
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const cookieToken = req.cookies?.accessToken;
  const headerToken = req.headers.authorization?.split(' ')[1];
  const token = cookieToken || headerToken;

  if (!token) {
    next();
    return;
  }

  getVerifier()
    .verify(token)
    .then((payload) => {
      req.user = {
        cognitoSub: payload.sub,
        username: payload.username as string | undefined,
        email: payload.email as string | undefined,
      };
      next();
    })
    .catch(() => {
      // Token invalid, but continue without user
      next();
    });
}
