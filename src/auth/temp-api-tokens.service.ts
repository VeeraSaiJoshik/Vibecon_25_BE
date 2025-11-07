import { Injectable } from "@nestjs/common";
import { JwtService } from "src/jwt/jwt.service";

import { AssemblyAI } from "assemblyai";

const client = new AssemblyAI({apiKey: process.env.ASSEMBLY_AI_API as string})

@Injectable()
export class TempApiTokensService {
    constructor(
        private readonly JWTTokenService: JwtService,
    ) {}

    async getAssemblyAIAuthTokens(): Promise<string> {
        return await client.streaming.createTemporaryToken({ expires_in_seconds: 60 });
    }
}