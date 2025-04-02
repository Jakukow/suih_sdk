import { SuiClient, MoveValue } from "@mysten/sui.js/client";
import {
  TransactionBlock,
  TransactionArgument,
} from "@mysten/sui.js/transactions";
import { normalizeSuiAddress } from "@mysten/sui.js/utils";
import {
  DEFAULT_CONFIG,
  SDKConfig,
  SubObject,
  SubscriptionEvent,
  SubscriptionInfo,
} from "./types";

const CLOCK_ADDRESS = "0x6";

export const FREE = 0;
export const TIER1 = 1;
export const TIER2 = 2;
export const PRICE_TIER1 = 10_000_000;
export const PRICE_TIER2 = 50_000_000;

export class SubscriptionManagerSDK {
  public client: SuiClient;
  public packageId: string;
  public subscriptionManagerId: string;

  constructor(config: SDKConfig = {}) {
    const networkConfig = DEFAULT_CONFIG[config.network || "testnet"];

    this.client = config.client || new SuiClient({ url: networkConfig.url });
    this.packageId = config.packageId || networkConfig.packageId;
    this.subscriptionManagerId =
      config.subscriptionManagerId || networkConfig.subscriptionManagerId;
  }

  async buySubscription(tier: number): Promise<TransactionBlock> {
    const tx = new TransactionBlock();
    const cost = this.getTierCost(tier);

    const paymentCoin =
      cost > 0 ? this.splitGasCoin(tx, cost) : this.createZeroCoin(tx);

    tx.moveCall({
      target: `${this.packageId}::SubscriptionManager::buy_subscription`,
      arguments: [
        tx.object(this.subscriptionManagerId),
        tx.pure(tier, "u8"),
        paymentCoin,
        tx.object(CLOCK_ADDRESS),
      ],
    });

    return tx;
  }

  private getTierCost(tier: number): number {
    switch (tier) {
      case TIER1:
        return PRICE_TIER1;
      case TIER2:
        return PRICE_TIER2;
      case FREE:
      default:
        return 0;
    }
  }

  private splitGasCoin(
    tx: TransactionBlock,
    amount: number
  ): TransactionArgument {
    const [coin] = tx.splitCoins(tx.gas, [tx.pure(amount)]);
    return coin;
  }

  private createZeroCoin(tx: TransactionBlock): TransactionArgument {
    const [coin] = tx.splitCoins(tx.gas, [tx.pure(0)]);
    return coin;
  }

  async getSubscription(userAddress: string): Promise<SubscriptionInfo | null> {
    const manager = await this.getManagerObject();

    const subscriptionsTableId =
      manager.content.fields.subscriptions.fields.id.id;

    try {
      const dynamicField = await this.client.getDynamicFieldObject({
        parentId: subscriptionsTableId,
        name: {
          type: "address",
          value: normalizeSuiAddress(userAddress),
        },
      });

      if (!dynamicField.data?.content) return null;

      return this.parseSubscriptionInfo(dynamicField.data.content);
    } catch (e: any) {
      if (e?.type === "InvalidParams" || e?.code === -32602) {
        return null;
      }

      throw e;
    }
  }

  private async getManagerObject(): Promise<SubObject> {
    const manager = await this.client.getObject({
      id: this.subscriptionManagerId,
      options: { showContent: true },
    });

    const data = manager.data;

    if (!data || !data.content) {
      throw new Error("Subscription manager object not found");
    }

    const content = data.content;

    if (
      content.dataType !== "moveObject" ||
      typeof content.fields !== "object" ||
      Array.isArray(content.fields)
    ) {
      throw new Error("Invalid subscription manager content structure");
    }

    const fields = content.fields as Record<string, MoveValue>;

    return {
      objectId: data.objectId,
      version: data.version,
      digest: data.digest,
      content: {
        fields: {
          admin: fields.admin as string,
          total_collected: fields.total_collected as string,
          subscriptions: fields.subscriptions as {
            fields: { id: { id: string } };
          },
        },
      },
    };
  }

  private parseSubscriptionInfo(content: any): SubscriptionInfo {
    return {
      tier: Number(content.fields.value.fields.tier),
      expirationTime: Number(content.fields.value.fields.expiration_time),
    };
  }

  async isSubscriptionActive(
    userAddress: string
  ): Promise<{ active: boolean; tier: number }> {
    const subscription = await this.getSubscription(userAddress);
    if (!subscription) return { active: false, tier: FREE };

    const clock = await this.client.getObject({
      id: CLOCK_ADDRESS,
      options: { showContent: true },
    });
    const data = clock.data;

    if (!data || !data.content) {
      throw new Error("Subscription manager object not found");
    }

    const content = data.content;

    if (
      content.dataType !== "moveObject" ||
      typeof content.fields !== "object" ||
      Array.isArray(content.fields)
    ) {
      throw new Error("Invalid subscription manager content structure");
    }

    const fields = content.fields as Record<string, MoveValue>;
    const currentTime = {
      content: {
        fields: {
          timestamp_ms: fields.timestamp_ms as number,
        },
      },
    };

    return {
      active:
        subscription.expirationTime > currentTime.content.fields.timestamp_ms,
      tier: subscription.tier,
    };
  }

  async withdrawAllFunds(adminAddress: string): Promise<TransactionBlock> {
    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${this.packageId}::SubscriptionManager::withdraw_all_funds`,
      arguments: [
        tx.object(this.subscriptionManagerId),
        tx.pure.address(normalizeSuiAddress(adminAddress)),
      ],
    });
    return tx;
  }

  async getSubscriptionEvents(
    options: {
      startTime?: number;
      endTime?: number;
      limit?: number;
    } = {}
  ): Promise<SubscriptionEvent[]> {
    const events = await this.client.queryEvents({
      query: {
        MoveEventType: `${this.packageId}::SubscriptionManager::SubscriptionEvent`,
        ...(options.startTime && { StartTime: options.startTime }),
        ...(options.endTime && { EndTime: options.endTime }),
      },
      limit: options.limit,
      order: "descending",
    });
    return events.data.map((event) => {
      const parsed = event.parsedJson as SubscriptionEvent;
      return {
        user: parsed.user,
        tier: parsed.tier,
        expiration_time: parsed.expiration_time,
      };
    });
  }

  async getTotalCollected(): Promise<number> {
    const manager = await this.getManagerObject();
    return +manager.content.fields.total_collected;
  }
  async getAdmin(): Promise<string> {
    const manager = await this.getManagerObject();
    return manager.content.fields.admin;
  }
}
