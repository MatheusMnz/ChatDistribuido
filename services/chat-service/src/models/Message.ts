import { Schema, model, Document, Types } from 'mongoose';

export interface IMessage extends Document {
  _id: Types.ObjectId;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  content: string;
  createdAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: { type: String, required: true, index: true },
    senderId: { type: String, required: true },
    senderUsername: { type: String, required: true },
    content: { type: String, required: true }
  },
  {
    // Apenas createdAt é parte do contrato Message.
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        if (ret.createdAt instanceof Date) ret.createdAt = ret.createdAt.toISOString();
        return ret;
      }
    }
  }
);

export const Message = model<IMessage>('Message', messageSchema);
