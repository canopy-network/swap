/**
 * Transaction building and signing
 *
 * Mirrors Go implementation in canopy/fsm/transaction.go
 * Handles multi-curve signing for Canopy blockchain transactions
 */

import { signMessage } from "./signing";
import { CurveType } from "./types";
import { getSignBytesProtobuf } from "./protobuf";
import type {
  TransactionParams,
  RawTransaction,
  TransactionMessage,
  TransactionSignature,
  MessageCreateOrderParams,
} from "./types";
import type { SendRawTransactionRequest } from "@/types/wallet";

/**
 * Creates and signs a transaction
 *
 * Mirrors fsm.NewTransaction() from canopy/fsm/transaction.go:424-441
 * This means we MUST sign PROTOBUF bytes, not JSON bytes!
 *
 * @param params - Transaction parameters
 * @param privateKeyHex - Hex-encoded private key
 * @param publicKeyHex - Hex-encoded public key
 * @param curveType - Curve type for signing
 * @returns SendRawTransactionRequest ready to submit to Launchpad
 */
export function createAndSignTransaction(
  params: TransactionParams,
  privateKeyHex: string,
  publicKeyHex: string,
  curveType: CurveType,
): SendRawTransactionRequest {
  // Build unsigned transaction
  // Mirrors lib.Transaction structure from canopy/lib/tx.go
  const unsignedTx: Omit<RawTransaction, "signature"> = {
    type: params.type,
    msg: params.msg,
    time: Date.now() * 1000, // Unix microseconds (Go uses time.Now().UnixMicro())
    createdHeight: params.height,
    fee: params.fee,
    memo: params.memo,
    networkID: params.networkID,
    chainID: params.chainID,
  };

  // Get PROTOBUF sign bytes (transaction without signature)
  // Mirrors lib.Transaction.GetSignBytes() from canopy/lib/tx.go:149-162
  // This MUST produce the EXACT same bytes as the Go implementation!
  const signBytes = getSignBytesProtobuf(unsignedTx);

  // Sign the canonical bytes with the correct curve algorithm
  const signatureHex = signMessage(signBytes, privateKeyHex, curveType);

  // Create signature structure
  const signature: TransactionSignature = {
    publicKey: publicKeyHex,
    signature: signatureHex,
  };

  // Build complete signed transaction
  const signedTx: RawTransaction = {
    ...unsignedTx,
    signature,
  };

  return {
    raw_transaction: signedTx,
  };
}

/**
 * Creates a Send transaction message
 *
 * Mirrors fsm.NewSendTransaction() from canopy/fsm/transaction.go:260-266
 *
 * @param fromAddress - Sender address (hex, no 0x prefix)
 * @param toAddress - Recipient address (hex, no 0x prefix)
 * @param amount - Amount in micro units (uCNPY)
 * @returns MessageSend payload
 */
export function createSendMessage(
  fromAddress: string,
  toAddress: string,
  amount: number,
): TransactionMessage {
  // Mirrors MessageSend structure from canopy/fsm/message.pb.go
  return {
    fromAddress,
    toAddress,
    amount,
  };
}

/**
 * Creates a CreateOrder transaction message (DEX)
 *
 * Mirrors fsm.NewCreateOrderTx() from canopy/fsm/transaction.go:366-375
 *
 * @param chainId - Chain ID for the order
 * @param data - Additional order data
 * @param amountForSale - Amount selling
 * @param requestedAmount - Amount requesting
 * @param sellerReceiveAddress - Address to receive payment
 * @param sellersSendAddress - Address sending tokens
 * @returns MessageCreateOrder payload
 */
export function createOrderMessage(
  chainId: number,
  data: string,
  amountForSale: number,
  requestedAmount: number,
  sellerReceiveAddress: string,
  sellersSendAddress: string,
): MessageCreateOrderParams {
  return {
    chainId,
    data,
    amountForSale,
    requestedAmount,
    sellerReceiveAddress,
    sellersSendAddress,
    orderId: "", // Will be populated by backend (first 20 bytes of tx hash)
  };
}

/**
 * Creates an EditOrder transaction message (DEX)
 *
 * Mirrors fsm.NewEditOrderTx() from canopy/fsm/transaction.go
 *
 * @param orderId - Hex-encoded order ID
 * @param chainId - Committee chain ID
 * @param data - Hex-encoded order data
 * @param amountForSale - New amount selling
 * @param requestedAmount - New amount requesting
 * @param sellerReceiveAddress - Hex-encoded receive address
 * @returns MessageEditOrder payload
 */
export function createEditOrderMessage(
  orderId: string,
  chainId: number,
  data: string,
  amountForSale: number,
  requestedAmount: number,
  sellerReceiveAddress: string,
): TransactionMessage {
  return {
    orderId,
    chainId,
    data,
    amountForSale,
    requestedAmount,
    sellerReceiveAddress,
  };
}

/**
 * Creates a DeleteOrder transaction message (DEX)
 *
 * Mirrors fsm.NewDeleteOrderTx() from canopy/fsm/transaction.go
 *
 * @param orderId - Hex-encoded order ID
 * @param chainId - Committee chain ID
 * @returns MessageDeleteOrder payload
 */
export function createDeleteOrderMessage(
  orderId: string,
  chainId: number,
): TransactionMessage {
  return {
    orderId,
    chainId,
  };
}

/**
 * Validates transaction parameters before signing
 *
 * @param params - Transaction parameters
 * @throws Error if validation fails
 */
export function validateTransactionParams(params: TransactionParams): void {
  // Validate message type
  if (!params.type || typeof params.type !== "string") {
    throw new Error("Invalid message type: must be a non-empty string");
  }

  // Validate message payload
  if (!params.msg || typeof params.msg !== "object") {
    throw new Error("Invalid message: must be an object");
  }

  // Validate fee
  if (typeof params.fee !== "number" || params.fee < 0) {
    throw new Error("Invalid fee: must be a non-negative number");
  }

  // Validate network ID
  if (typeof params.networkID !== "number" || params.networkID <= 0) {
    throw new Error("Invalid network ID: must be a positive number");
  }

  // Validate chain ID
  if (typeof params.chainID !== "number" || params.chainID <= 0) {
    throw new Error("Invalid chain ID: must be a positive number");
  }

  // Validate height
  if (typeof params.height !== "number" || params.height < 0) {
    throw new Error("Invalid height: must be a non-negative number");
  }

  // Validate memo length
  if (params.memo && params.memo.length > 200) {
    throw new Error("Invalid memo: must be 200 characters or less");
  }
}

/**
 * Estimates the size of a transaction in bytes
 *
 * Useful for fee estimation and validation
 *
 * @param tx - Transaction to estimate
 * @returns Estimated size in bytes
 */
export function estimateTransactionSize(tx: RawTransaction): number {
  const jsonString = JSON.stringify(tx);
  return new TextEncoder().encode(jsonString).length;
}

/**
 * Gets the transaction hash (for tracking before submission)
 *
 * NOTE: This is a client-side hash. The authoritative hash
 * is computed by the backend and returned in the response.
 *
 * @param tx - Signed transaction
 * @returns Hex-encoded hash
 */
export async function getTransactionHash(tx: RawTransaction): Promise<string> {
  const jsonString = JSON.stringify(tx);
  const bytes = new TextEncoder().encode(jsonString);

  // Use browser's SubtleCrypto for SHA-256
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}
