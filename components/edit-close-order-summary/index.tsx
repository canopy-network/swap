import { ArrowDown, X } from "lucide-react";
import { Button } from "../ui/button";
import { TradingPair } from "@/types/trading-pair";
import { submitSignedTransaction } from "@/services/orders";
import { numberToBlockchainUValue } from "@/utils/blockchain";
import { ProcessedTransaction } from "@/types/transactions";
import { useState } from "react";
import { useWallets } from "@/context/wallet";
import { toast } from "sonner";
import { getKeyfilePassword } from "@/utils/keyfile-session";
import ProgressToast from "../headless-toast/progress-toast";
import AssetCard from "../asset-card";
import {
  createSignedEditOrder,
  createSignedDeleteOrder,
} from "@/lib/crypto/utils/order";
import { MINIMUN_FEE } from "@/constants/blockchain";
import { usePollingData } from "@/context/polling-context";
import { sliceAddress } from "@/utils/address";

interface EditCloseOrderSummaryProps {
  tradingPair: TradingPair;
  isBuySide: boolean;
  payAmount: string;
  receiveAmount: string;
  payBalance: string;
  receiveBalance: string;
  transaction: ProcessedTransaction;
  onClose: () => void;
}

function EditCloseOrderSummary({
  tradingPair,
  isBuySide,
  onClose,
  payAmount,
  receiveAmount,
  payBalance,
  receiveBalance,
  transaction,
}: EditCloseOrderSummaryProps) {
  const { selectedCanopyWallet } = useWallets();
  const { height } = usePollingData();

  const [payInput, setPayInput] = useState(payAmount);
  const [receiveInput, setReceiveInput] = useState(receiveAmount);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const payAsset = isBuySide ? tradingPair.baseAsset : tradingPair.quoteAsset;
  const receiveAsset = isBuySide
    ? tradingPair.quoteAsset
    : tradingPair.baseAsset;

  const handleEditAskOrder = async () => {
    if (!selectedCanopyWallet?.filename || !transaction.rawData.order) {
      toast("Error", {
        description: "No Canopy wallet or order selected",
        duration: 5000,
      });
      return;
    }

    const password = getKeyfilePassword(selectedCanopyWallet.filename);
    if (!password) {
      toast("Error", {
        description:
          "Keyfile password not found. Please re-authenticate your keyfile.",
        duration: 5000,
      });
      return;
    }

    setIsLoading(true);

    try {
      const signedTx = await createSignedEditOrder(
        selectedCanopyWallet,
        password,
        {
          orderId: transaction.rawData.order.id,
          chainId: tradingPair.committee,
          data: sliceAddress(tradingPair.contractAddress),
          amountForSale: numberToBlockchainUValue(Number(payInput)),
          requestedAmount: numberToBlockchainUValue(Number(receiveInput)),
          sellerReceiveAddress: sliceAddress(
            transaction.rawData.order.sellerReceiveAddress,
          ),
        },
        {
          networkID: tradingPair.committee,
          chainID: 1,
          currentHeight: height?.height || 0,
          fee: MINIMUN_FEE,
        },
      );

      // Submit the signed transaction to the Canopy network
      await submitSignedTransaction(signedTx, tradingPair.committee);

      toast("Transaction Status", {
        description: (
          <ProgressToast
            payAssetSymbol={payAsset.symbol}
            receiveAssetSymbol={receiveAsset.symbol}
            duration={20000}
            title="Edit order in Progress"
          />
        ),
        duration: 20000,
      });

      onClose();
    } catch (error) {
      toast("Error", {
        description: `Failed to edit order: ${error}`,
        duration: 5000,
        richColors: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAskOrder = async () => {
    if (!selectedCanopyWallet?.filename || !transaction.rawData.order) {
      toast("Error", {
        description: "No Canopy wallet or order selected",
        duration: 5000,
      });
      return;
    }

    const password = getKeyfilePassword(selectedCanopyWallet.filename);
    if (!password) {
      toast("Error", {
        description:
          "Keyfile password not found. Please re-authenticate your keyfile.",
        duration: 5000,
      });
      return;
    }

    setIsLoading(true);

    try {
      const signedTx = await createSignedDeleteOrder(
        selectedCanopyWallet,
        password,
        {
          orderId: transaction.rawData.order.id,
          chainId: tradingPair.committee,
        },
        {
          networkID: tradingPair.committee,
          chainID: 1,
          currentHeight: height?.height || 0,
          fee: MINIMUN_FEE,
        },
      );

      // Submit the signed transaction to the Canopy network
      await submitSignedTransaction(signedTx, tradingPair.committee);

      toast("Transaction Status", {
        description: (
          <ProgressToast
            payAssetSymbol={payAsset.symbol}
            receiveAssetSymbol={receiveAsset.symbol}
            duration={20000}
            title="Cancelation in Progress"
          />
        ),
        duration: 20000,
      });

      onClose();
    } catch (error) {
      toast("Error", {
        description: `Failed to delete order: ${error}`,
        duration: 5000,
        richColors: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-background p-6">
      <div className="pb-2 flex flex-row items-center justify-between">
        <h2 className="text-xl font-bold">Transaction Summary</h2>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <AssetCard
          asset={payAsset}
          label="You pay"
          amount={payInput}
          balance={payBalance}
          editable={true}
          onAmountChange={setPayInput}
        />

        <div className="flex justify-center">
          <div className="rounded-full w-10 h-10 flex items-center justify-center">
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <AssetCard
          asset={receiveAsset}
          label="You receive"
          amount={receiveInput}
          balance={receiveBalance}
          editable={true}
          onAmountChange={setReceiveInput}
        />

        <div className="flex flex-col gap-2 my-2">
          <Button
            variant="ghost"
            className="w-full h-12 text-lg font-medium rounded-xl mt-auto bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleEditAskOrder}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Edit Ask Order"}
          </Button>
          <Button
            variant="secondary"
            className="w-full h-12 text-lg font-medium rounded-xl mt-auto text-error-foreground bg-error disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleDeleteAskOrder}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Cancel Ask Order"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default EditCloseOrderSummary;
