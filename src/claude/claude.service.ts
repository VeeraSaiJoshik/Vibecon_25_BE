/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { Conversation } from "../entities/conversation.entity";
import { Message } from "../entities/message.entity";
import { CreateConversationDto } from "../dto/create-conversation.dto";
import { SendMessageDto } from "../dto/send-message.dto";
import { UpdateConversationDto } from "../dto/update-conversation.dto";

@Injectable()
export class ClaudeService {
  private anthropic: Anthropic;

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Create a new conversation for a user
   */
  async createConversation(
    userId: string,
    createConversationDto: CreateConversationDto,
  ): Promise<Conversation> {
    const conversation = this.conversationRepository.create({
      userId,
      systemPrompt: createConversationDto.systemPrompt,
      model: createConversationDto.model || "claude-3-5-sonnet-20241022",
      temperature: createConversationDto.temperature ?? 1.0,
      maxTokens: createConversationDto.maxTokens || 4096,
      createdAt: new Date(),
      updatedAt: new Date(),
      totalTokensUsed: 0,
    });

    return await this.conversationRepository.save(conversation);
  }

  /**
   * Get all conversations for a user
   */
  async getConversations(userId: string): Promise<Conversation[]> {
    return await this.conversationRepository.find({
      where: { userId },
      order: { updatedAt: "DESC" },
    });
  }

  /**
   * Get a specific conversation with its messages
   */
  async getConversation(conversationId: string, userId: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, userId },
      relations: ["messages"],
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    return conversation;
  }

  /**
   * Update conversation settings
   */
  async updateConversation(
    conversationId: string,
    userId: string,
    updateConversationDto: UpdateConversationDto,
  ): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    Object.assign(conversation, {
      ...updateConversationDto,
      updatedAt: new Date(),
    });

    return await this.conversationRepository.save(conversation);
  }

  /**
   * Delete a conversation and all its messages
   */
  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    await this.conversationRepository.remove(conversation);
  }

  /**
   * Send a message to Claude (non-streaming)
   */
  async sendMessage(
    userId: string,
    sendMessageDto: SendMessageDto,
  ): Promise<{ conversation: Conversation; userMessage: Message; assistantMessage: Message }> {
    let conversation: Conversation;

    // Get or create conversation
    if (sendMessageDto.conversationId) {
      conversation = await this.getConversation(sendMessageDto.conversationId, userId);

      // Update conversation settings if provided
      if (sendMessageDto.systemPrompt !== undefined) {
        conversation.systemPrompt = sendMessageDto.systemPrompt;
      }
      if (sendMessageDto.model) {
        conversation.model = sendMessageDto.model;
      }
      if (sendMessageDto.temperature !== undefined) {
        conversation.temperature = sendMessageDto.temperature;
      }
      if (sendMessageDto.maxTokens) {
        conversation.maxTokens = sendMessageDto.maxTokens;
      }
      // Persist updated settings before making API call
      await this.conversationRepository.save(conversation);
    } else {
      // Create new conversation
      conversation = await this.createConversation(userId, {
        systemPrompt: sendMessageDto.systemPrompt,
        model: sendMessageDto.model,
        temperature: sendMessageDto.temperature,
        maxTokens: sendMessageDto.maxTokens,
      });
    }

    // Save user message
    const userMessage = await this.saveMessage(
      conversation.id,
      "user",
      sendMessageDto.message,
      0,
    );

    // Get conversation history
    const messages = await this.messageRepository.find({
      where: { conversationId: conversation.id },
      order: { createdAt: "ASC" },
    });

    // Build messages array for Claude API
    const apiMessages: Anthropic.Messages.MessageParam[] = messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    // Call Claude API
    const response = await this.anthropic.messages.create({
      model: conversation.model,
      max_tokens: conversation.maxTokens,
      temperature: conversation.temperature,
      system: conversation.systemPrompt,
      messages: apiMessages,
    });

    // Extract text content from response
    const assistantContent = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Save assistant message
    const assistantMessage = await this.saveMessage(
      conversation.id,
      "assistant",
      assistantContent,
      response.usage.output_tokens,
    );

    // Update conversation token usage
    conversation.totalTokensUsed += response.usage.input_tokens + response.usage.output_tokens;
    conversation.updatedAt = new Date();
    await this.conversationRepository.save(conversation);

    return { conversation, userMessage, assistantMessage };
  }

  /**
   * Send a message to Claude with streaming
   */
  async *sendMessageStream(
    userId: string,
    sendMessageDto: SendMessageDto,
  ): AsyncGenerator<string, void, unknown> {
    let conversation: Conversation;

    // Get or create conversation
    if (sendMessageDto.conversationId) {
      conversation = await this.getConversation(sendMessageDto.conversationId, userId);

      // Update conversation settings if provided
      if (sendMessageDto.systemPrompt !== undefined) {
        conversation.systemPrompt = sendMessageDto.systemPrompt;
      }
      if (sendMessageDto.model) {
        conversation.model = sendMessageDto.model;
      }
      if (sendMessageDto.temperature !== undefined) {
        conversation.temperature = sendMessageDto.temperature;
      }
      if (sendMessageDto.maxTokens) {
        conversation.maxTokens = sendMessageDto.maxTokens;
      }
      // Persist updated settings before making API call
      await this.conversationRepository.save(conversation);
    } else {
      // Create new conversation
      conversation = await this.createConversation(userId, {
        systemPrompt: sendMessageDto.systemPrompt,
        model: sendMessageDto.model,
        temperature: sendMessageDto.temperature,
        maxTokens: sendMessageDto.maxTokens,
      });
    }

    // Save user message
    await this.saveMessage(conversation.id, "user", sendMessageDto.message, 0);

    // Get conversation history
    const messages = await this.messageRepository.find({
      where: { conversationId: conversation.id },
      order: { createdAt: "ASC" },
    });

    // Build messages array for Claude API
    const apiMessages: Anthropic.Messages.MessageParam[] = messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    // Call Claude API with streaming
    const stream = await this.anthropic.messages.create({
      model: conversation.model,
      max_tokens: conversation.maxTokens,
      temperature: conversation.temperature,
      system: conversation.systemPrompt,
      messages: apiMessages,
      stream: true,
    });

    let fullResponse = "";
    let inputTokens = 0;
    let outputTokens = 0;

    // Stream the response
    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          const text = event.delta.text;
          fullResponse += text;
          yield text;
        }
      } else if (event.type === "message_start") {
        inputTokens = event.message.usage.input_tokens;
      } else if (event.type === "message_delta") {
        outputTokens = event.usage.output_tokens;
      }
    }

    // Save assistant message after streaming completes
    await this.saveMessage(conversation.id, "assistant", fullResponse, outputTokens);

    // Update conversation token usage
    conversation.totalTokensUsed += inputTokens + outputTokens;
    await this.conversationRepository.save(conversation);
  }

  /**
   * Helper method to save a message
   */
  private async saveMessage(
    conversationId: string,
    role: string,
    content: string,
    tokensUsed: number,
  ): Promise<Message> {
    const message = this.messageRepository.create({
      conversationId,
      role,
      content,
      tokensUsed,
      createdAt: new Date(),
    });

    return await this.messageRepository.save(message);
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string, userId: string): Promise<Message[]> {
    // Verify user owns the conversation
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    return await this.messageRepository.find({
      where: { conversationId },
      order: { createdAt: "ASC" },
    });
  }
}
