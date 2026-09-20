import type { Channel, Direction, Interaction } from '../../shared/schemas.js';

const CONTEXT_BODY_MAX = 1600;
const ELISION_MARKER = '\n[…] content truncated for context budget …';

export type InteractionContext = {
  channel: Channel;
  direction: Direction;
  capturedAt: string;
  content: string;
};

export function assembleInteractionContext(interaction: Interaction): InteractionContext {
  const content =
    interaction.content.length > CONTEXT_BODY_MAX
      ? `${interaction.content.slice(0, CONTEXT_BODY_MAX)}${ELISION_MARKER}`
      : interaction.content;
  return {
    channel: interaction.channel,
    direction: interaction.direction,
    capturedAt: interaction.capturedAt,
    content,
  };
}