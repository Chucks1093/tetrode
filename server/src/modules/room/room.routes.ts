import { Router } from 'express';
import {
   httpCreateRoom,
   httpGetRoomById,
   httpGetRoomParticipants,
   httpJoinRoom,
   httpLeaveRoom,
   httpListRooms,
} from './room.controllers';

const roomRouter = Router();

roomRouter.get('/', httpListRooms);
roomRouter.post('/', httpCreateRoom);
roomRouter.get('/:roomId', httpGetRoomById);
roomRouter.get('/:roomId/participants', httpGetRoomParticipants);
roomRouter.post('/:roomId/join', httpJoinRoom);
roomRouter.post('/:roomId/leave', httpLeaveRoom);

export default roomRouter;
