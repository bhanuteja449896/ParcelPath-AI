import { AgentContext } from "@/lib/types";
import { withUserContext } from "../withUserContext";

export interface Order {
  id: string;
  orderId: string;
  accountId: string;
  carrier: string;
  serviceLevel: string | null;
  status: 'pending' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled' | 'exception';
  origin: string | null;
  destination: string | null;
  pickupAt: Date | null;
  promisedDeliveryAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SELECT_COLUMNS = `
  id,
  order_id AS "orderId",
  account_id AS "accountId",
  carrier,
  service_level AS "serviceLevel",
  status,
  origin,
  destination,
  pickup_at AS "pickupAt",
  promised_delivery_at AS "promisedDeliveryAt",
  delivered_at AS "deliveredAt",
  cancelled_at AS "cancelledAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export const ordersRepo = {
  /**
   * Retrieves a single order by its business ID (e.g., ORD-1001).
   */
  async getByOrderId(ctx: AgentContext, orderId: string): Promise<Order | null> {
    return await withUserContext(ctx, async (tx) => {
      const rows = await tx<any[]>`
        SELECT ${tx.unsafe(SELECT_COLUMNS)}
        FROM orders
        WHERE order_id = ${orderId}
      `;
      return rows.length ? (rows[0] as Order) : null;
    });
  },

  /**
   * Lists orders for a specific account. RLS will enforce account isolation, 
   * but providing accountId ensures the query is cleanly scoped.
   */
  async listByAccount(ctx: AgentContext, accountId: string): Promise<Order[]> {
    return await withUserContext(ctx, async (tx) => {
      const rows = await tx<any[]>`
        SELECT ${tx.unsafe(SELECT_COLUMNS)}
        FROM orders
        WHERE account_id = ${accountId}
        ORDER BY created_at DESC
      `;
      return rows as Order[];
    });
  },

  /**
   * Transitions an order from one status to another.
   * Uses Compare-And-Swap (CAS) to prevent race conditions.
   * Returns true if successful, false if the record was not found or fromStatus didn't match.
   */
  async transitionStatus(
    ctx: AgentContext, 
    orderId: string, 
    fromStatus: string, 
    toStatus: string
  ): Promise<boolean> {
    return await withUserContext(ctx, async (tx) => {
      const rows = await tx`
        UPDATE orders
        SET 
          status = ${toStatus},
          cancelled_at = CASE WHEN ${toStatus} = 'cancelled' THEN now() ELSE cancelled_at END,
          delivered_at = CASE WHEN ${toStatus} = 'delivered' THEN now() ELSE delivered_at END
        WHERE order_id = ${orderId} 
          AND status = ${fromStatus}
        RETURNING id
      `;
      return rows.length > 0;
    });
  }
};
