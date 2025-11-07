import { Entity, Column, PrimaryGeneratedColumn, Generated, ManyToOne, JoinColumn } from "typeorm";
import { Conversation } from "./conversation.entity";

@Entity()
export class Message {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  conversationId: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages)
  @JoinColumn({ name: "conversationId" })
  conversation: Conversation;

  @Column()
  role: string; // 'user' or 'assistant'

  @Column({ type: "text" })
  content: string;

  @Column()
  createdAt: Date;

  @Column({ default: 0 })
  tokensUsed: number;
}
