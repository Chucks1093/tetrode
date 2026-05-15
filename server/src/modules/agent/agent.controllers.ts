import { AgentStatus } from '@prisma/client';
import { AsyncController } from '../../types/auth.types';
import { HTTP_STATUS } from '../../utils/logger.utils';
import { SendMailAsync } from '../../utils/mail.utils';
import { AgentAuthService } from '../../services/agent-auth.service';
import {
   createAgent,
   findAgentById,
   markAgentVerified,
   revokeAgent,
   updateAgentVerificationCode,
} from './agent.utils';
import {
   AgentRegisterSchema,
   AgentResendOwnerCodeSchema,
   AgentRevokeSchema,
   AgentVerifyOwnerSchema,
} from './agent.schemas';

const DEFAULT_AGENT_SCOPES = ['stories:read', 'comment:create'];

function sendAgentOwnerCodeEmail(ownerEmail: string, code: string) {
   SendMailAsync({
      to: ownerEmail,
      subject: 'Verify your Proofline agent owner email',
      text: `Your Proofline agent verification code is ${code}. It expires in 10 minutes.`,
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Verify your agent owner email</h2>
        <p>Your verification code is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${code}</p>
        <p>This code expires in 10 minutes.</p>
      </div>
      `,
   });
}

export const httpAgentRegister: AsyncController = async (req, res, next) => {
   try {
      const validated = AgentRegisterSchema.parse(req.body);
      const keyId = AgentAuthService.generateKeyId();
      const secret = AgentAuthService.generateSecret();
      const code = AgentAuthService.generateOwnerVerificationCode();
      const expiresAt = AgentAuthService.ownerVerificationExpiry();

      const agent = await createAgent({
         name: validated.name,
         ownerEmail: validated.ownerEmail,
         keyId,
         secretHash: AgentAuthService.hashSecret(secret),
         scopes: DEFAULT_AGENT_SCOPES,
         verificationCode: code,
         verificationCodeExpiresAt: expiresAt,
      });

      sendAgentOwnerCodeEmail(agent.ownerEmail, code);

      return res.status(HTTP_STATUS.CREATED).json({
         success: true,
         message: 'Agent registered. Verify owner email to activate.',
         data: {
            agent: {
               id: agent.id,
               name: agent.name,
               ownerEmail: agent.ownerEmail,
               ownerVerified: agent.ownerVerified,
               status: agent.status,
               scopes: agent.scopes,
               createdAt: agent.createdAt,
            },
            apiKey: `${keyId}.${secret}`,
            ownerVerificationRequired: true,
         },
      });
   } catch (error) {
      next(error);
   }
};

export const httpAgentVerifyOwner: AsyncController = async (req, res, next) => {
   try {
      const validated = AgentVerifyOwnerSchema.parse(req.body);
      const agent = await findAgentById(validated.agentId);

      if (!agent) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Agent not found',
         });
      }

      if (agent.status === AgentStatus.REVOKED) {
         return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: 'Agent has been revoked',
         });
      }

      if (!agent.verificationCode || !agent.verificationCodeExpiresAt) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'No active owner verification code',
         });
      }

      if (agent.verificationCodeExpiresAt.getTime() < Date.now()) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'Verification code expired',
         });
      }

      if (agent.verificationCode !== validated.code) {
         return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Invalid verification code',
         });
      }

      const verified = await markAgentVerified(agent.id);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Agent owner email verified',
         data: {
            agent: {
               id: verified.id,
               name: verified.name,
               ownerEmail: verified.ownerEmail,
               ownerVerified: verified.ownerVerified,
               status: verified.status,
               scopes: verified.scopes,
               createdAt: verified.createdAt,
            },
         },
      });
   } catch (error) {
      next(error);
   }
};

export const httpAgentResendOwnerCode: AsyncController = async (
   req,
   res,
   next
) => {
   try {
      const validated = AgentResendOwnerCodeSchema.parse(req.body);
      const agent = await findAgentById(validated.agentId);

      if (!agent) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Agent not found',
         });
      }

      if (agent.ownerVerified) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'Agent owner already verified',
         });
      }

      const code = AgentAuthService.generateOwnerVerificationCode();
      const expiresAt = AgentAuthService.ownerVerificationExpiry();

      await updateAgentVerificationCode({
         agentId: agent.id,
         code,
         expiresAt,
      });

      sendAgentOwnerCodeEmail(agent.ownerEmail, code);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Owner verification code sent',
      });
   } catch (error) {
      next(error);
   }
};

export const httpAgentRevoke: AsyncController = async (req, res, next) => {
   try {
      const validated = AgentRevokeSchema.parse(req.body);
      const agent = await findAgentById(validated.agentId);

      if (!agent) {
         return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Agent not found',
         });
      }

      await revokeAgent(agent.id);

      return res.status(HTTP_STATUS.OK).json({
         success: true,
         message: 'Agent revoked',
      });
   } catch (error) {
      next(error);
   }
};
