import { Router } from 'express';
import {
   httpCreateChatMessage,
   httpListChatMessages,
} from './chat.controllers';

const chatRouter = Router({ mergeParams: true });

chatRouter.get('/messages', httpListChatMessages);
chatRouter.post('/messages', httpCreateChatMessage);

export default chatRouter;
