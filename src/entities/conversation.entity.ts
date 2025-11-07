import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Generated,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Message } from "./message.entity";

@Entity()
export class Conversation {
  @PrimaryGeneratedColumn()
  @Generated("uuid")
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user: User;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  @Column({ nullable: true })
  systemPrompt: string;

  @Column({ default: "claude-3-5-sonnet-20241022" })
  model: string;

  @Column({ type: "float", default: 1.0 })
  temperature: number;

  @Column({ default: 4096 })
  maxTokens: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: 0 })
  totalTokensUsed: number;
}
