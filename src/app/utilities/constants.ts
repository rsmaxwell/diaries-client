
export const Constants = {
    reqTopic: 'diaries/rpc/request',
    replyTopic: (clientId: string) => `diaries/rpc/${clientId}/response`
};
