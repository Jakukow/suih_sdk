import { SuiClient } from "@mysten/sui.js/dist/cjs/client";

export interface SubscriptionInfo {
  tier: number;
  expirationTime: number;
}

export interface SubscriptionEvent {
  user: string;
  tier: number;
  expiration_time: number;
}
export interface SDKConfig {
  client?: SuiClient;
  packageId?: string;
  subscriptionManagerId?: string;
  network?: "testnet" | "devnet" | "mainnet";
}

export interface SubObject {
  objectId: string;
  digest: string;
  version: string;
  content: {
    fields: {
      admin: string;
      total_collected: string;
      subscriptions: {
        fields: {
          id: {
            id: string;
          };
        };
      };
    };
  };
}

export type MoveStruct = {
  [key: string]: MoveValue;
};

export type MoveValue =
  | string
  | number
  | boolean
  | { [key: string]: MoveValue }
  | MoveValue[];

export const DEFAULT_CONFIG = {
  testnet: {
    packageId:
      "0x9dc94dd2222c559d2c3e30ddb43cea0517a4d4f01b13e0fc655c65c8d209e456",
    subscriptionManagerId:
      "0x917c24d6cbb368b3ad4cae5d550bfe744e488d4b94987188217258b1518dde3c",
    url: "https://fullnode.testnet.sui.io:443",
  },
  devnet: {
    packageId: "",
    subscriptionManagerId: "",
    url: "",
  },
  mainnet: {
    packageId: "",
    subscriptionManagerId: "",
    url: "",
  },
};
