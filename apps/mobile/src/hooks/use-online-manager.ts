import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { useEffect, useState } from "react";

function onNetInfoChange(state: NetInfoState) {
  const isOnline = state.isConnected === true && state.isInternetReachable !== false;
  onlineManager.setOnline(isOnline);
}

export function useOnlineManager() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      onNetInfoChange(state);
    });

    NetInfo.fetch().then((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      onNetInfoChange(state);
    });

    return unsubscribe;
  }, []);

  return isOnline;
}
