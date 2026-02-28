declare module '@xmtp/xmtp-js' {
  export class Client {
    static create(wallet: any, options?: { env?: string }): Promise<Client>;
    conversations: {
      newConversation(address: string): Promise<any>;
    };
  }
}
