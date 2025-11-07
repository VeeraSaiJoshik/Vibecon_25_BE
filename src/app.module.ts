import { RolesModule } from "./roles/roles.module";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "./users/users.module";
import { User } from "./entities/user.entity";
import { Conversation } from "./entities/conversation.entity";
import { Message } from "./entities/message.entity";
import { AuthModule } from "./auth/auth.module";
import { JwtModule } from "./jwt/jwt.module";
import { DbModule } from "./db/db.module";
import { ClaudeModule } from "./claude/claude.module";
import { ConfigModule } from "@nestjs/config";

/** DO NOT DELETE
 * app.module is the master module that imports all other modules
 * Deleting app.module means that no other modules would be runnable
 *
 */
@Module({
  imports: [
    RolesModule,
    TypeOrmModule.forRoot({
      type: "sqlite",
      database: "../database.db", // Use repo root database for compatibility
      entities: [User, Conversation, Message],
      synchronize: true,
    }),
    ConfigModule.forRoot({
      isGlobal: true,

      // Environment variable resolution strategy:
      // If NODE_ENV is set, load the corresponding .env file (e.g., .env.production).
      // Otherwise, fall back to the default .env file.
      envFilePath: [
        process.env.NODE_ENV ? `./src/.env.${process.env.NODE_ENV}` : "",
        "./src/.env",
      ].filter(Boolean),
    }),
    UsersModule,
    AuthModule,
    JwtModule,
    DbModule,
    ClaudeModule,
  ],
})
export class AppModule {}
