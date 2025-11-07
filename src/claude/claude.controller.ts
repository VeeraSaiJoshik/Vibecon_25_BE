/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { ClaudeService } from "./claude.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RateLimitGuard } from "./rate-limit.guard";
import { CreateConversationDto } from "../dto/create-conversation.dto";
import { SendMessageDto } from "../dto/send-message.dto";
import { UpdateConversationDto } from "../dto/update-conversation.dto";

interface RequestWithUser {
  user: {
    id: string;
    username: string;
    role: string;
  };
}

@Controller("claude")
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class ClaudeController {
  constructor(private readonly claudeService: ClaudeService) {}

  /**
   * POST /claude/message - Send a message to Claude
   * Supports both streaming and non-streaming responses
   */
  @Post("message")
  async sendMessage(
    @Req() req: RequestWithUser,
    @Body() sendMessageDto: SendMessageDto,
    @Res() res: Response,
  ) {
    const userId = req.user.id;

    // Default to streaming if not specified
    const shouldStream = sendMessageDto.stream !== false;

    if (shouldStream) {
      // Set headers for Server-Sent Events
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      try {
        const stream = this.claudeService.sendMessageStream(userId, sendMessageDto);

        for await (const chunk of stream) {
          // Send as Server-Sent Event
          res.write(`data: ${JSON.stringify({ type: "content", text: chunk })}\n\n`);
        }

        // Send completion event
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      } catch (error) {
        res.write(`data: ${JSON.stringify({ type: "error", message: (error as Error).message })}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming response
      try {
        const result = await this.claudeService.sendMessage(userId, sendMessageDto);
        res.json({
          success: true,
          conversation: {
            id: result.conversation.id,
            model: result.conversation.model,
            totalTokensUsed: result.conversation.totalTokensUsed,
          },
          message: {
            id: result.assistantMessage.id,
            content: result.assistantMessage.content,
            tokensUsed: result.assistantMessage.tokensUsed,
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * POST /claude/conversations - Create a new conversation
   */
  @Post("conversations")
  async createConversation(
    @Req() req: RequestWithUser,
    @Body() createConversationDto: CreateConversationDto,
  ) {
    const userId = req.user.id;
    const conversation = await this.claudeService.createConversation(
      userId,
      createConversationDto,
    );

    return {
      success: true,
      conversation: {
        id: conversation.id,
        model: conversation.model,
        temperature: conversation.temperature,
        maxTokens: conversation.maxTokens,
        systemPrompt: conversation.systemPrompt,
        createdAt: conversation.createdAt,
      },
    };
  }

  /**
   * GET /claude/conversations - Get all conversations for the user
   */
  @Get("conversations")
  async getConversations(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    const conversations = await this.claudeService.getConversations(userId);

    return {
      success: true,
      conversations: conversations.map((conv) => ({
        id: conv.id,
        model: conv.model,
        temperature: conv.temperature,
        maxTokens: conv.maxTokens,
        systemPrompt: conv.systemPrompt,
        totalTokensUsed: conv.totalTokensUsed,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      })),
    };
  }

  /**
   * GET /claude/conversations/:id - Get a specific conversation with messages
   */
  @Get("conversations/:id")
  async getConversation(@Req() req: RequestWithUser, @Param("id") conversationId: string) {
    const userId = req.user.id;
    const conversation = await this.claudeService.getConversation(conversationId, userId);

    return {
      success: true,
      conversation: {
        id: conversation.id,
        model: conversation.model,
        temperature: conversation.temperature,
        maxTokens: conversation.maxTokens,
        systemPrompt: conversation.systemPrompt,
        totalTokensUsed: conversation.totalTokensUsed,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messages: conversation.messages?.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          tokensUsed: msg.tokensUsed,
          createdAt: msg.createdAt,
        })),
      },
    };
  }

  /**
   * GET /claude/conversations/:id/messages - Get messages for a conversation
   */
  @Get("conversations/:id/messages")
  async getMessages(@Req() req: RequestWithUser, @Param("id") conversationId: string) {
    const userId = req.user.id;
    const messages = await this.claudeService.getMessages(conversationId, userId);

    return {
      success: true,
      messages: messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        tokensUsed: msg.tokensUsed,
        createdAt: msg.createdAt,
      })),
    };
  }

  /**
   * PATCH /claude/conversations/:id - Update conversation settings
   */
  @Patch("conversations/:id")
  async updateConversation(
    @Req() req: RequestWithUser,
    @Param("id") conversationId: string,
    @Body() updateConversationDto: UpdateConversationDto,
  ) {
    const userId = req.user.id;
    const conversation = await this.claudeService.updateConversation(
      conversationId,
      userId,
      updateConversationDto,
    );

    return {
      success: true,
      conversation: {
        id: conversation.id,
        model: conversation.model,
        temperature: conversation.temperature,
        maxTokens: conversation.maxTokens,
        systemPrompt: conversation.systemPrompt,
        updatedAt: conversation.updatedAt,
      },
    };
  }

  /**
   * DELETE /claude/conversations/:id - Delete a conversation
   */
  @Delete("conversations/:id")
  async deleteConversation(@Req() req: RequestWithUser, @Param("id") conversationId: string) {
    const userId = req.user.id;
    await this.claudeService.deleteConversation(conversationId, userId);

    return {
      success: true,
      message: "Conversation deleted successfully",
    };
  }
}
