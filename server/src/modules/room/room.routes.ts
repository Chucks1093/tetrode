import { Router } from 'express';
import {
   httpCreateRoom,
   httpGetRoomById,
   httpGetRoomParticipants,
   httpJoinRoom,
   httpLeaveRoom,
   httpListRooms,
   httpGetMyActiveRoom,
   httpCastVote,
   httpGetRoomResults,
} from './room.controllers';

const roomRouter = Router();

roomRouter.get('/', httpListRooms);
roomRouter.post('/', httpCreateRoom);
roomRouter.get('/my-active', httpGetMyActiveRoom);
roomRouter.get('/:roomId', httpGetRoomById);
roomRouter.get('/:roomId/participants', httpGetRoomParticipants);
roomRouter.get('/:roomId/results', httpGetRoomResults);
roomRouter.post('/:roomId/join', httpJoinRoom);
roomRouter.post('/:roomId/leave', httpLeaveRoom);
roomRouter.post('/:roomId/votes', httpCastVote);

export default roomRouter;
