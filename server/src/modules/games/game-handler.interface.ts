import { ParticipantType } from '@prisma/client';

export type RoomParticipant = {
	id: string;
	publicId: string;
	actorId: string;
	displayName: string;
	type: ParticipantType;
	walletAddress?: string | null;
};

export interface GameHandler {
	onRoomStart(roomPublicId: string, roomId: string, participants: RoomParticipant[]): void;
	onRoomEnd(roomPublicId: string): void;
}
