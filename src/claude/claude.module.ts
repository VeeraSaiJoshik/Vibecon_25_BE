import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClaudeController } from "./claude.controller";
import { ClaudeService } from "./claude.service";
import { RateLimitGuard } from "./rate-limit.guard";
import { Conversation } from "../entities/conversation.entity";
import { Message } from "../entities/message.entity";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message]),
    forwardRef(() => AuthModule),
  ],
  providers: [ClaudeService, RateLimitGuard],
  controllers: [ClaudeController],
  exports: [ClaudeService],
})
export class ClaudeModule {}
