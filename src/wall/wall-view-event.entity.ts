import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class WallViewEvent {
  @Prop({ required: true, index: true })
  viewerId!: string;

  @Prop({ required: true, index: true })
  postId!: string;

  @Prop({ required: true, index: true })
  authorId!: string;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ default: 0 })
  totalDwellMs?: number;

  @Prop({ default: 0 })
  viewsCount?: number;

  @Prop({ default: 0 })
  profileOpenCount?: number;

  @Prop({ default: 0 })
  commentOpenCount?: number;

  @Prop({ default: 0 })
  mediaOpenCount?: number;

  @Prop({ default: 0 })
  tagTapCount?: number;

  @Prop({ default: 0 })
  mediaDwellMs?: number;

  @Prop({ default: false })
  hiddenPost?: boolean;

  @Prop({ default: false })
  mutedAuthor?: boolean;

  @Prop({ default: 0 })
  tooRepetitiveCount?: number;

  @Prop({ default: 0 })
  notMyTypeCount?: number;

  @Prop({ default: Date.now })
  lastViewedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export type WallViewEventDocument = HydratedDocument<WallViewEvent>;

export const WallViewEventSchema = SchemaFactory.createForClass(WallViewEvent);

WallViewEventSchema.index({ viewerId: 1, postId: 1 }, { unique: true });
