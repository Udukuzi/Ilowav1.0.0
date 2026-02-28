declare module '@react-native-community/netinfo' {
  export interface NetInfoState {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    type: string;
  }

  export type NetInfoChangeHandler = (state: NetInfoState) => void;

  const NetInfo: {
    fetch(): Promise<NetInfoState>;
    addEventListener(listener: NetInfoChangeHandler): () => void;
  };

  export default NetInfo;
}
