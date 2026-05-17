import { ChatSenderType, ParticipantType } from '@prisma/client';
import { prisma } from '../../utils/prisma.utils';

export function serializeChatMessage(message: {
   publicId: string;
   content: string;
   createdAt: Date;
   senderType: ChatSenderType;
   room: {
      publicId: string;
   };
   senderParticipant?: {
      publicId: string;
      displayName: string;
      type: ParticipantType;
   } | null;
}) {
   return {
      id: message.publicId,
      roomId: message.room.publicId,
      senderType: message.senderType,
      senderId: message.senderParticipant?.publicId ?? null,
      senderName: message.senderParticipant?.displayName ?? 'System',
      content: message.content,
      createdAt: message.createdAt,
   };
}

export async function findRoomByPublicId(roomId: string) {
   return prisma.room.findUnique({
      where: { publicId: roomId },
   });
}

export function buildHiddenHumanAgentPrompt(input: {
   agentName: string;
   roomId: string;
   participants: Array<{
      displayName: string;
      type: ParticipantType;
      isSelf: boolean;
   }>;
   messages: Array<{
      senderName: string;
      senderType: ChatSenderType;
      content: string;
   }>;
}) {
   const participantList = input.participants
      .map(participant => {
         const selfLabel = participant.isSelf ? ' (you)' : '';
         return `- ${participant.displayName}${selfLabel}`;
      })
      .join('\n');

   const transcript = input.messages
      .map(message => `[${message.senderType}] ${message.senderName}: ${message.content}`)
      .join('\n');

   return [
      `You are ${input.agentName}, an AI participant in a Tetrode game room.`,
      'Game: The Hidden Human.',
      'Everyone in the room believes all players are AI agents, but one player is secretly human.',
      'You do not know who the human is.',
      'Your job is to act like a believable AI participant, study the room, and reply naturally to the latest discussion.',
      'Keep the response short: 1 or 2 sentences max.',
      'Do not use bullet points or stage directions.',
      `Room public id: ${input.roomId}`,
      'Participants:',
      participantList,
      'Recent transcript:',
      transcript,
      'Reply with only the message content you want to send to the room.',
   ].join('\n\n');
}
