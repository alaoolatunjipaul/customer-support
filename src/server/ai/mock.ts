import type { DraftKind, Interaction } from '../../shared/schemas.js';
import type { InteractionContext } from './context.js';

const QUOTE_MAX = 240;

type Facts = {
  orderRefPresent: boolean;
  pricePresent: boolean;
  timelinePresent: boolean;
  isQuestion: boolean;
  isThanks: boolean;
  isConcern: boolean;
  tone: string;
  present: string[];
  missing: string[];
};

function analyse(text: string): Facts {
  const orderRefPresent =
    /\b(order|tracking|invoice|receipt)\b/i.test(text) && /[A-Z0-9]{4,}/.test(text);
  const pricePresent = /\$[\s\d]|\b(price|cost|quote|invoice|receipt)\b/i.test(text);
  const timelinePresent = /\b(today|tomorrow|this week|next week|deliver|dispatch|ship|arriv|friday|monday)\b/i.test(text);
  const isQuestion = /\?\s*$/.test(text.trim());
  const isThanks = /\b(thanks|thank you|appreciate)\b/i.test(text);
  const isConcern = /\b(wrong|damaged|missing|broken|disappoint|unhappy|upset|angry|delay|late|refund|issue|problem|complaint)\b/i.test(text);

  const present: string[] = [];
  if (orderRefPresent) present.push('order reference (present in the message)');
  if (pricePresent) present.push('pricing or order value (stated)');
  if (timelinePresent) present.push('timeline (delivery, dispatch, or availability mentioned)');
  if (isQuestion) present.push('an explicit question to be answered');
  if (present.length === 0) present.push('only the quoted message');

  const missing: string[] = [];
  if (!orderRefPresent) missing.push('order reference — not provided in the message');
  if (!pricePresent) missing.push('order value or pricing — not stated');
  if (!timelinePresent) missing.push('delivery or availability timeline — not stated');

  const tone = isThanks && !isConcern ? 'positive (thanks expressed)' : isConcern ? 'negative (frustration or issue mentioned)' : 'neutral';

  return { orderRefPresent, pricePresent, timelinePresent, isQuestion, isThanks, isConcern, tone, present, missing };
}

function directionLabel(direction: string): string {
  return direction === 'INBOUND' ? 'Inbound (customer to us)' : 'Outbound (us to customer)';
}

function quote(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= QUOTE_MAX) return trimmed;
  return `${trimmed.slice(0, QUOTE_MAX)} […]`;
}

function channelLabel(channel: string): string {
  if (channel === 'INSTAGRAM') return 'Instagram';
  if (channel === 'FACEBOOK') return 'Facebook';
  return 'X';
}

function greeting(channel: string): string {
  if (channel === 'X') return 'Hi!';
  if (channel === 'FACEBOOK') return 'Hello!';
  return 'Hi there!';
}

function buildSummary(interaction: Interaction, context: InteractionContext): string {
  const facts = analyse(context.content);
  const missingLine =
    facts.missing.length > 0
      ? facts.missing.join('; ')
      : 'none identified — but nothing beyond the message may be added';
  return [
    `[AI SUMMARY — draft, not logged]`,
    `${directionLabel(interaction.direction)} ${channelLabel(interaction.channel)} message (${interaction.capturedAt.slice(0, 10)}): “${quote(context.content)}”`,
    `Grounded facts: ${facts.present.join('; ')}.`,
    `Tone indicator: ${facts.tone}.`,
    `Missing information: ${missingLine}.`,
  ].join('\n');
}

function buildCrmNote(interaction: Interaction, context: InteractionContext): string {
  const facts = analyse(context.content);
  const missingLine =
    facts.missing.length > 0
      ? facts.missing.join('; ')
      : 'none identified — nothing beyond the message is recorded';
  const followUp = facts.isQuestion
    ? 'yes — the customer asked an unanswered question'
    : facts.isConcern
      ? 'yes — flagged concern to resolve'
      : 'none stated in the message';
  return [
    `[CRM NOTE — DRAFT, pending human approval, not logged]`,
    `Channel: ${channelLabel(interaction.channel)}`,
    `Direction: ${directionLabel(interaction.direction)}`,
    `Captured: ${interaction.capturedAt.slice(0, 10)}`,
    `Message: “${quote(context.content)}”`,
    `Grounded facts: ${facts.present.join('; ')}.`,
    `Tone indicator: ${facts.tone}.`,
    `Follow-up needed: ${followUp}.`,
    `Missing information: ${missingLine}.`,
  ].join('\n');
}

function buildResponse(interaction: Interaction, context: InteractionContext): string {
  const facts = analyse(context.content);
  const g = greeting(interaction.channel);

  let body: string;
  let ask: string;
  if (facts.isConcern) {
    body = "We're sorry this happened — we want to make it right.";
    ask = facts.orderRefPresent
      ? 'Your order reference is noted; we will check and reply here shortly.'
      : 'Could you share your order number so we can look into it right away?';
  } else if (facts.isQuestion) {
    body = 'Happy to help with that.';
    ask = facts.orderRefPresent
      ? 'Your order reference is noted; we will look into it and reply here.'
      : 'To help, could you send us your order number or a little more detail?';
  } else if (facts.isThanks) {
    body = "You're very welcome!";
    ask = `Let us know if anything else comes up — we're here on ${channelLabel(interaction.channel)}.`;
  } else {
    body = 'Thanks for your message.';
    ask = facts.orderRefPresent
      ? 'Your order reference is noted; we will follow up here.'
      : 'If an order or account is involved, sharing a reference will let us help faster.';
  }

  return `${g} ${body}\n\n${ask}\n\n[Not sent — draft for human review before sending.]`;
}

export function mockGenerate(params: { kind: DraftKind; interaction: Interaction; context: InteractionContext }): string {
  switch (params.kind) {
    case 'SUMMARY':
      return buildSummary(params.interaction, params.context);
    case 'CRM_NOTE':
      return buildCrmNote(params.interaction, params.context);
    case 'RESPONSE':
      return buildResponse(params.interaction, params.context);
  }
}