/**
 * Example: Creating and signing a DEX order using encrypted keys
 *
 * This example demonstrates the complete flow:
 * 1. Convert key format from storage to crypto library format
 * 2. Decrypt private key using password
 * 3. Create order message
 * 4. Sign transaction
 * 5. Submit to Launchpad API
 */
import type {
  CanopyWalletAccount,
  SendRawTransactionRequest,
} from "@/types/wallet";
import { decryptPrivateKey } from "../wallet";
import { CurveType, TransactionParams } from "../types";
import {
  createAndSignTransaction,
  createOrderMessage,
  createEditOrderMessage,
  createDeleteOrderMessage,
} from "../transaction";

/**
 * Complete example: Create and sign a DEX order
 *
 * @param storedKey - Encrypted key from storage
 * @param password - Password to decrypt the key
 * @param orderParams - Order parameters
 * @param networkParams - Network configuration
 * @returns Signed transaction ready to submit
 */
export async function createSignedOrder(
  storedKey: CanopyWalletAccount,
  password: string,
  orderParams: {
    chainId: number;
    data: string;
    amountForSale: number;
    requestedAmount: number;
    sellerReceiveAddress: string;
    sellersSendAddress: string;
  },
  networkParams: {
    networkID: number;
    chainID: number;
    currentHeight: number;
    fee: number;
  },
): Promise<SendRawTransactionRequest> {
  const privateKeyBytes = await decryptPrivateKey(
    storedKey.encryptedKeyfile,
    password,
  );
  const privateKeyHex = Array.from(privateKeyBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Step 3: Detect curve type from public key length
  // BLS12381: 48 bytes (96 hex chars), ED25519: 32 bytes (64 hex chars)
  const publicKeyBytes = storedKey.encryptedKeyfile.publicKey.length / 2;
  const curveType =
    publicKeyBytes === 48 ? CurveType.BLS12381 : CurveType.ED25519;

  // Step 4: Create order message
  const orderMsg = createOrderMessage(
    orderParams.chainId,
    orderParams.data,
    orderParams.amountForSale,
    orderParams.requestedAmount,
    orderParams.sellerReceiveAddress,
    orderParams.sellersSendAddress,
  );

  // Step 5: Build transaction parameters
  const txParams: TransactionParams = {
    type: "createOrder",
    msg: orderMsg,
    fee: networkParams.fee,
    memo: "",
    networkID: networkParams.networkID,
    chainID: networkParams.chainID,
    height: networkParams.currentHeight,
  };

  // Step 6: Sign transaction (uses PROTOBUF encoding internally)
  const signedTx = createAndSignTransaction(
    txParams,
    privateKeyHex,
    storedKey.encryptedKeyfile.publicKey,
    curveType,
  );

  return signedTx;
}

/**
 * Complete example: Edit and sign a DEX order
 *
 * @param storedKey - Encrypted key from storage
 * @param password - Password to decrypt the key
 * @param editParams - Edit order parameters
 * @param networkParams - Network configuration
 * @returns Signed transaction ready to submit
 */
export async function createSignedEditOrder(
  storedKey: CanopyWalletAccount,
  password: string,
  editParams: {
    orderId: string;
    chainId: number;
    data: string;
    amountForSale: number;
    requestedAmount: number;
    sellerReceiveAddress: string;
  },
  networkParams: {
    networkID: number;
    chainID: number;
    currentHeight: number;
    fee: number;
  },
): Promise<SendRawTransactionRequest> {
  const privateKeyBytes = await decryptPrivateKey(
    storedKey.encryptedKeyfile,
    password,
  );
  const privateKeyHex = Array.from(privateKeyBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Detect curve type from public key length
  const publicKeyBytes = storedKey.encryptedKeyfile.publicKey.length / 2;
  const curveType =
    publicKeyBytes === 48 ? CurveType.BLS12381 : CurveType.ED25519;

  // Create edit order message
  const editMsg = createEditOrderMessage(
    editParams.orderId,
    editParams.chainId,
    editParams.data,
    editParams.amountForSale,
    editParams.requestedAmount,
    editParams.sellerReceiveAddress,
  );

  // Build transaction parameters
  const txParams: TransactionParams = {
    type: "editOrder",
    msg: editMsg,
    fee: networkParams.fee,
    memo: "",
    networkID: networkParams.networkID,
    chainID: networkParams.chainID,
    height: networkParams.currentHeight,
  };

  // Sign transaction
  const signedTx = createAndSignTransaction(
    txParams,
    privateKeyHex,
    storedKey.encryptedKeyfile.publicKey,
    curveType,
  );

  return signedTx;
}

/**
 * Complete example: Delete and sign a DEX order
 *
 * @param storedKey - Encrypted key from storage
 * @param password - Password to decrypt the key
 * @param deleteParams - Delete order parameters
 * @param networkParams - Network configuration
 * @returns Signed transaction ready to submit
 */
export async function createSignedDeleteOrder(
  storedKey: CanopyWalletAccount,
  password: string,
  deleteParams: {
    orderId: string;
    chainId: number;
  },
  networkParams: {
    networkID: number;
    chainID: number;
    currentHeight: number;
    fee: number;
  },
): Promise<SendRawTransactionRequest> {
  const privateKeyBytes = await decryptPrivateKey(
    storedKey.encryptedKeyfile,
    password,
  );
  const privateKeyHex = Array.from(privateKeyBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Detect curve type from public key length
  const publicKeyBytes = storedKey.encryptedKeyfile.publicKey.length / 2;
  const curveType =
    publicKeyBytes === 48 ? CurveType.BLS12381 : CurveType.ED25519;

  // Create delete order message
  const deleteMsg = createDeleteOrderMessage(
    deleteParams.orderId,
    deleteParams.chainId,
  );

  // Build transaction parameters
  const txParams: TransactionParams = {
    type: "deleteOrder",
    msg: deleteMsg,
    fee: networkParams.fee,
    memo: "",
    networkID: networkParams.networkID,
    chainID: networkParams.chainID,
    height: networkParams.currentHeight,
  };

  // Sign transaction
  const signedTx = createAndSignTransaction(
    txParams,
    privateKeyHex,
    storedKey.encryptedKeyfile.publicKey,
    curveType,
  );

  return signedTx;
}
