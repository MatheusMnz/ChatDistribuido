import { Schema, model, Document, Types } from 'mongoose';

export interface ILastMessage {
  content: string;
  senderId: string;
  createdAt: Date;
}

export interface IConversation extends Document {
  _id: Types.ObjectId;
  type: 'direct' | 'group';
  name?: string;
  participantIds: string[];
  lastMessage?: ILastMessage;
  createdAt: Date;
  updatedAt: Date;
}

const lastMessageSchema = new Schema<ILastMessage>(
  {
    content: { type: String, required: true },
    senderId: { type: String, required: true },
    createdAt: { type: Date, required: true }
  },
  { _id: false }
);

const conversationSchema = new Schema<IConversation>(
  {
    type: { type: String, enum: ['direct', 'group'], required: true },
    name: { type: String },
    participantIds: {
      type: [String],
      required: true,
      index: true,
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length >= 2,
        message: 'A conversation must have at least 2 participants'
      }
    },
    lastMessage: { type: lastMessageSchema, required: false }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        // Datas como strings ISO
        if (ret.createdAt instanceof Date) ret.createdAt = ret.createdAt.toISOString();
        if (ret.updatedAt instanceof Date) ret.updatedAt = ret.updatedAt.toISOString();
        const last = ret.lastMessage as { createdAt?: unknown } | undefined;
        if (last && last.createdAt instanceof Date) {
          last.createdAt = last.createdAt.toISOString();
        }
        return ret;
      }
    }
  }
);

export const Conversation = model<IConversation>('Conversation', conversationSchema);
