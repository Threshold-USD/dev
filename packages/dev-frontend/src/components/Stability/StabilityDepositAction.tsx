import { Button } from "theme-ui";
import { Decimal, StabilityDepositChange } from "@liquity/lib-base";
import { useLiquity } from "../../hooks/LiquityContext";
import { useTransactionFunction } from "../Transaction";

type StabilityDepositActionProps = {
  transactionId: string;
  change: StabilityDepositChange<Decimal>;
};

export const StabilityDepositAction: React.FC<StabilityDepositActionProps> = ({
  children,
  transactionId,
  change
}) => {
  const { liquity } = useLiquity();

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    change.depositLUSD
      ? liquity.send.depositLUSDInStabilityPool.bind(liquity.send, change.depositLUSD)
      : liquity.send.withdrawLUSDFromStabilityPool.bind(liquity.send, change.withdrawLUSD)
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};
