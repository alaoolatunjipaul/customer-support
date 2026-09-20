import { z } from 'zod';

export const ChannelSchema = z.enum(['X', 'INSTAGRAM', 'FACEBOOK']);
export type Channel = z.infer<typeof ChannelSchema>;

export const DirectionSchema = z.enum(['INBOUND', 'OUTBOUND']);
export type Direction = z.infer<typeof DirectionSchema>;

export const CustomerStatusSchema = z.enum(['ACTIVE', 'ATTENTION', 'INACTIVE']);
export type CustomerStatus = z.infer<typeof CustomerStatusSchema>;

export const ActivityKindSchema = z.enum(['POST', 'COMMENT', 'DM', 'TICKET', 'RESOLVED', 'ESCALATED']);
export type ActivityKind = z.infer<typeof ActivityKindSchema>;

export const CustomerProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  handle: z.string().min(1),
  channel: ChannelSchema,
  summary: z.string().min(1),
  bio: z.string().min(1),
  location: z.string().min(1),
  joinedYear: z.number().int(),
  status: CustomerStatusSchema,
  tags: z.array(z.string()),
  isSynthetic: z.literal(true),
});
export type CustomerProfile = z.infer<typeof CustomerProfileSchema>;

export const ActivitySchema = z.object({
  id: z.string().min(1),
  kind: ActivityKindSchema,
  summary: z.string().min(1),
  crmNote: z.string().min(1),
  suggestedResponse: z.string().nullable(),
  channel: ChannelSchema,
  direction: DirectionSchema,
  loggedAt: z.string().min(1),
  approvedBy: z.string().min(1),
  isSynthetic: z.literal(true),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const InteractionStatusSchema = z.enum(['CAPTURED', 'LOGGED']);
export type InteractionStatus = z.infer<typeof InteractionStatusSchema>;

export const InteractionSchema = z.object({
  id: z.string().min(1),
  customerId: z.string().min(1),
  channel: ChannelSchema,
  direction: DirectionSchema,
  content: z.string().min(1).max(2000),
  status: InteractionStatusSchema,
  capturedBy: z.string().min(1),
  capturedAt: z.string().min(1),
  isSynthetic: z.literal(true),
});
export type Interaction = z.infer<typeof InteractionSchema>;

export const TimelineItemSchema = z.discriminatedUnion('source', [
  ActivitySchema.extend({ source: z.literal('logged') }),
  InteractionSchema.extend({ source: z.literal('captured') }),
]);
export type TimelineItem = z.infer<typeof TimelineItemSchema>;

export const CustomerDetailSchema = CustomerProfileSchema.extend({
  activityTimeline: z.array(TimelineItemSchema),
});
export type CustomerDetail = z.infer<typeof CustomerDetailSchema>;

export const AgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  isSynthetic: z.literal(true),
});
export type Agent = z.infer<typeof AgentSchema>;

export const ChannelCountSchema = z.object({
  channel: ChannelSchema,
  count: z.number().int().nonnegative(),
});
export type ChannelCount = z.infer<typeof ChannelCountSchema>;

export const DashboardSchema = z.object({
  totalCustomers: z.number().int().nonnegative(),
  totalActivities: z.number().int().nonnegative(),
  openInteractions: z.number().int().nonnegative(),
  todayActivities: z.number().int().nonnegative(),
  byChannel: z.array(ChannelCountSchema),
  recentActivities: z.array(
    ActivitySchema.extend({ customerId: z.string().min(1), customerName: z.string(), customerHandle: z.string() }),
  ),
  agents: z.array(AgentSchema),
});
export type Dashboard = z.infer<typeof DashboardSchema>;

export const CustomerListQuerySchema = z.object({
  search: z.string().max(120).optional(),
  channel: ChannelSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type CustomerListQuery = z.infer<typeof CustomerListQuerySchema>;

export const CustomerListSchema = z.object({
  items: z.array(CustomerProfileSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int(),
  offset: z.number().int(),
});
export type CustomerList = z.infer<typeof CustomerListSchema>;

export const CustomerListResponseSchema = CustomerListSchema;
export type CustomerListResponse = z.infer<typeof CustomerListResponseSchema>;

export const CaptureInteractionInputSchema = z
  .object({
    channel: ChannelSchema,
    direction: DirectionSchema,
    content: z.string().trim().min(1, 'Content is required.').max(2000, 'Content is limited to 2000 characters.'),
    capturedBy: z.string().min(1).optional(),
  })
  .strict();
export type CaptureInteractionInput = z.infer<typeof CaptureInteractionInputSchema>;

export const CaptureInteractionResponseSchema = z.object({
  interaction: InteractionSchema,
});
export type CaptureInteractionResponse = z.infer<typeof CaptureInteractionResponseSchema>;

export const InteractionDetailResponseSchema = z.object({
  interaction: InteractionSchema,
});
export type InteractionDetailResponse = z.infer<typeof InteractionDetailResponseSchema>;

export const DraftKindSchema = z.enum(['SUMMARY', 'CRM_NOTE', 'RESPONSE']);
export type DraftKind = z.infer<typeof DraftKindSchema>;

export const DraftContentSchema = z
  .string()
  .trim()
  .min(1, 'Draft content is required.')
  .max(2000, 'Draft content is limited to 2000 characters.');

export const DraftSourceSchema = z.object({
  channel: ChannelSchema,
  direction: DirectionSchema,
  content: z.string().max(2000),
  capturedAt: z.string().min(1),
});
export type DraftSource = z.infer<typeof DraftSourceSchema>;

export const AiDraftSchema = z.object({
  id: z.string().min(1),
  interactionId: z.string().min(1),
  kind: DraftKindSchema,
  content: DraftContentSchema,
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  source: DraftSourceSchema,
  revision: z.number().int().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  supersededAt: z.string().nullable(),
  isSynthetic: z.literal(true),
});
export type AiDraft = z.infer<typeof AiDraftSchema>;

export const DraftListResponseSchema = z.object({
  items: z.array(AiDraftSchema),
  total: z.number().int().nonnegative(),
});
export type DraftListResponse = z.infer<typeof DraftListResponseSchema>;

export const GenerateDraftResponseSchema = z.object({
  draft: AiDraftSchema,
});
export type GenerateDraftResponse = z.infer<typeof GenerateDraftResponseSchema>;

export const UpdateDraftInputSchema = z.object({
  content: DraftContentSchema,
}).strict();
export type UpdateDraftInput = z.infer<typeof UpdateDraftInputSchema>;

export const GenerateDraftInputSchema = z
  .object({
    actor: z.string().min(1).optional(),
  })
  .strict();
export type GenerateDraftInput = z.infer<typeof GenerateDraftInputSchema>;

export const LogInteractionInputSchema = z
  .object({
    kind: ActivityKindSchema,
    actor: z.string().min(1).optional(),
  })
  .strict();
export type LogInteractionInput = z.infer<typeof LogInteractionInputSchema>;

export const LogInteractionResponseSchema = z.object({
  activity: ActivitySchema,
});
export type LogInteractionResponse = z.infer<typeof LogInteractionResponseSchema>;

export const AuditActionSchema = z.enum(['CAPTURE', 'AI_GENERATE', 'DRAFT_EDIT', 'ACTIVITY_LOGGED']);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditEntrySchema = z.object({
  id: z.string().min(1),
  actor: z.string().min(1),
  action: AuditActionSchema,
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  payloadBefore: z.unknown().nullable(),
  payloadAfter: z.unknown().nullable(),
  createdAt: z.string().min(1),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const AuditListResponseSchema = z.object({
  items: z.array(AuditEntrySchema),
  total: z.number().int().nonnegative(),
});
export type AuditListResponse = z.infer<typeof AuditListResponseSchema>;

export const HealthSchema = z.object({
  ok: z.literal(true),
  service: z.string(),
  version: z.string(),
  data: z.object({
    customers: z.number().int(),
    activities: z.number().int(),
    interactions: z.number().int(),
    agents: z.number().int(),
  }),
  ai: z.object({
    configured: z.boolean(),
    mode: z.string(),
  }),
});
export type Health = z.infer<typeof HealthSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;