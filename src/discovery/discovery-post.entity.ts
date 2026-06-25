import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'discovery_posts' })
export class DiscoveryPost {
  @Prop({ required: true, unique: true, index: true })
  postId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop()
  authorName?: string;

  @Prop()
  authorAvatar?: string;

  @Prop()
  caption?: string;

  @Prop()
  imageUrl?: string;

  @Prop({ type: [String], default: [] })
  imageUrls?: string[];

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ default: 0 })
  viewsCount?: number;

  @Prop({ type: [String], default: [] })
  viewedBy?: string[];

  @Prop()
  sourceType?: string;

  @Prop()
  sourceUpdatedAt?: Date;

  @Prop()
  sourceCreatedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export type DiscoveryPostDocument = HydratedDocument<DiscoveryPost>;

export const DiscoveryPostSchema = SchemaFactory.createForClass(DiscoveryPost);
