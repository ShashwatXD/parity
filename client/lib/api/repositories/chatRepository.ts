import { API_ROUTES, HEADER_RUN_ID } from '../../constants';
import type { ChatSendInput, ChatSendResult } from '../../models';
import { apiStream } from '../client';

export const chatRepository = {
  async send(body: ChatSendInput): Promise<ChatSendResult> {
    const response = await apiStream(API_ROUTES.chat, body);
    return {
      response,
      runId: response.headers.get(HEADER_RUN_ID) ?? '',
    };
  },
};
