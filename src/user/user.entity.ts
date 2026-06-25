import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

@Schema({ _id: false })
export class MatchAgeRange {
  @Prop()
  min?: number;

  @Prop()
  max?: number;
}

export const MatchAgeRangeSchema = SchemaFactory.createForClass(MatchAgeRange);

@Schema({ _id: false })
export class MatchPreferences {
  @Prop({ type: MatchAgeRangeSchema, default: {} })
  ageRange?: MatchAgeRange;

  @Prop({ type: [String], default: [] })
  preferredProvinces?: string[];

  @Prop({ type: [String], default: [] })
  preferredCities?: string[];

  @Prop({ type: [String], default: [] })
  preferredReligions?: string[];

  @Prop({ type: [String], default: [] })
  preferredCastes?: string[];

  @Prop({ type: [String], default: [] })
  preferredEducationKeywords?: string[];

  @Prop({ type: [String], default: [] })
  preferredOccupationKeywords?: string[];

  @Prop({ type: [String], default: [] })
  preferredInterests?: string[];

  @Prop({ type: [String], default: [] })
  preferredHobbies?: string[];

  @Prop({ type: [String], default: [] })
  preferredMaritalStatuses?: string[];

  @Prop({ type: [String], default: [] })
  dealBreakers?: string[];

  @Prop()
  updatedAt?: Date;
}

export const MatchPreferencesSchema =
  SchemaFactory.createForClass(MatchPreferences);

// Keep user ids consistent with `mrkapu-auth-service`/`mrkapu-user-service`
// by using the same Mongo collection (`auth_users`).
@Schema({ collection: 'auth_users', timestamps: true })
export class User {
  @Prop({ sparse: true })
  email?: string;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop()
  phoneNumber?: string;

  @Prop()
  dob?: string;

  @Prop()
  age?: number;

  @Prop()
  city?: string;

  @Prop()
  province?: string;

  @Prop()
  location?: string;

  @Prop()
  religion?: string;

  @Prop()
  caste?: string;

  @Prop()
  education?: string;

  @Prop()
  occupation?: string;

  @Prop()
  job?: string;

  @Prop()
  monthlyIncomeRange?: string;

  @Prop()
  maritalStatus?: string;

  @Prop()
  avatarUrl?: string;

  @Prop()
  role?: string;

  @Prop()
  provider?: string;

  @Prop({ type: [String], default: [] })
  interests?: string[];

  @Prop({ type: [String], default: [] })
  hobbies?: string[];

  @Prop({ type: [String], default: [] })
  sports?: string[];

  @Prop({ type: [String], default: [] })
  favoritePlaces?: string[];

  @Prop({ type: [String], default: [] })
  serviceCategories?: string[];

  @Prop({ type: [String], default: [] })
  followingIds?: string[];

  @Prop({ default: false })
  verifiedPhoneNumber?: boolean;

  @Prop({ default: false })
  verifiedEmail?: boolean;

  @Prop({ default: false })
  isProfileVerified?: boolean;

  @Prop({ default: false })
  isBot?: boolean;

  @Prop({ default: 0 })
  profileCompletion?: number;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  matchPreferences?: MatchPreferences | Record<string, unknown>;

  createdAt?: Date;
  updatedAt?: Date;
}

export type UserDocument = HydratedDocument<User>;

export const UserSchema = SchemaFactory.createForClass(User);
