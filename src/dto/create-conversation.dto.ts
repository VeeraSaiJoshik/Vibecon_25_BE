import { IsOptional, IsString, IsNumber, Min, Max } from "class-validator";

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200000)
  maxTokens?: number;
}
