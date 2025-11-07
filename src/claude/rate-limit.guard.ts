import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from "@nestjs/common";

interface RequestWithUser {
  user?: {
    id: string;
  };
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private rateLimits = new Map<string, RateLimitEntry>();
  private readonly maxRequests = 20; // Maximum requests per window
  private readonly windowMs = 60000; // 1 minute window

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.id;

    if (!userId) {
      // If no user ID, let the JWT guard handle it
      return true;
    }

    const now = Date.now();
    const userLimit = this.rateLimits.get(userId);

    // Clean up expired entries periodically
    if (Math.random() < 0.1) {
      this.cleanupExpiredEntries(now);
    }

    if (!userLimit || now > userLimit.resetTime) {
      // Create new window
      this.rateLimits.set(userId, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    // Increment atomically to prevent race conditions
    userLimit.count++;

    if (userLimit.count > this.maxRequests) {
      // Decrement back since request is rejected
      userLimit.count--;
      const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: "Too many requests. Please try again later.",
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private cleanupExpiredEntries(now: number): void {
    for (const [userId, limit] of this.rateLimits.entries()) {
      if (now > limit.resetTime) {
        this.rateLimits.delete(userId);
      }
    }
  }
}
