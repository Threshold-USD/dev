import { useState, useEffect } from "react";
import { Box, Card, Flex } from "theme-ui";
import { Decimal, Percent, LiquityStoreState as ThresholdStoreState } from "@threshold-usd/lib-base";
import { useThresholdSelector } from "@threshold-usd/lib-react";
import { COIN } from "../utils/constants";

import { SystemStat } from "./SystemStat";
import { EditPrice } from "./Dashboard/EditPrice";
import { MintErc20 } from "./Dashboard/MintErc20";

type SystemStatsCardProps = {
  variant?: string;
  IsPriceEditable?: boolean
};

const selector = ({
  numberOfTroves,
  price,
  total,
  thusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  pcvBalance,
  symbol,
  bammDeposit,
}: ThresholdStoreState) => ({
  numberOfTroves,
  price,
  total,
  thusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  pcvBalance,
  symbol,
  bammDeposit,
  totalCollateralRatio: new Percent(total.collateralRatio(price)),
  loanToValue: new Percent(total.loanToValue(price))
});

export const SystemStatsCard = ({ variant = "info", IsPriceEditable }: SystemStatsCardProps): JSX.Element => {
  const thresholdSelectorStores = useThresholdSelector(selector);
  const [borrowingFeeAvgPct, setBorrowingFeeAvgPct] = useState(new Percent(Decimal.from(0)))
  const [totalVaults, setTotalVaults] = useState(0)
  // const [thusdInSP, setThusdInSP] = useState(Decimal.from(0))
  const [thusdInBammm, setThusdInBamm] = useState(Decimal.from(0))
  const [thusdSupply, setThusdSupply] = useState(Decimal.from(0))
  const [pcvBal, setPcvBal] = useState(Decimal.from(0))
  const [isMounted, setIsMounted] = useState<boolean>(true);

  useEffect(() => {
    if (!isMounted) {
      return;
    }
    let borrowingFee = Decimal.from(0)
    let thusdSupply = Decimal.from(0)
    let thusdInBamm = Decimal.from(0)

    thresholdSelectorStores.forEach(collateralStore => {
      const thresholdStore = thresholdSelectorStores.find((store) => {
        return store.version === collateralStore.version && store.collateral === collateralStore.collateral;
      });

      borrowingFee = borrowingFee.add(thresholdStore?.store.borrowingRate!)
      setTotalVaults(prev => prev + thresholdStore?.store.numberOfTroves!)
      // setThusdInSP(prev => prev.add(thresholdStore?.store.thusdInStabilityPool!))
      setPcvBal(prev => prev.add(thresholdStore?.store.pcvBalance!))
      thusdSupply = thusdSupply.add(thresholdStore?.store.total.debt!)
      thusdInBamm = thusdInBamm.add(thresholdStore?.store.bammDeposit.totalThusdInBamm!)
    })

    const borrowingfeeAvg = borrowingFee.div(thresholdSelectorStores.length)
    setBorrowingFeeAvgPct(new Percent(borrowingfeeAvg))
    setThusdSupply(thusdSupply)
    setThusdInBamm(thusdInBamm)

    return () => {
      setIsMounted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted])

  return (
    <Card {...{ variant }} sx={{ width: "100%", bg: "systemStatsBackGround"}}>
      <Card variant="layout.columns">
        <Flex sx={{
          width: "100%",
          gap: 1,
          pb: 3,
          borderBottom: 1,
          borderColor: "border"
        }}>
          Network Stats
        </Flex>
        <Flex sx={{
          width: "100%",
          fontSize: "0.9em",
          flexDirection: "column",
          color: "text",
          pt: "2em",
          gap: "1em"
        }}>   
          <SystemStat
            info="Total Vaults"
            tooltip="The total number of active Vaults in the system."
          >
            {Decimal.from(totalVaults).prettify(0)}
          </SystemStat>
          {thresholdSelectorStores.map((collateralStore, index) => (
            <SystemStat
              key={index}
              info={`${ collateralStore.store.symbol } deposited collateral`}
              tooltip={`The Total Value Locked (TVL) is the total value of ${ collateralStore.store.symbol } locked as collateral in the system.`}
            >
              { collateralStore.store.total.collateral.shorten() } { collateralStore.store.symbol }
            </SystemStat>
          ))}
          <SystemStat
            info={`${ COIN } in B.AMM`}
            tooltip={`The total ${ COIN } currently held in the Backstop AMM, expressed as an amount.`}
          >
            {thusdInBammm.shorten()}
          </SystemStat>
          <SystemStat
            info={`${ COIN } in PCV`}
            tooltip={`The total ${ COIN } currently held in the PCV, expressed as an amount and a fraction of the ${ COIN } supply.`}
          >
            {pcvBal.shorten()}
          </SystemStat>             
          <SystemStat
            info={`${ COIN } Supply`}
            tooltip={`The total ${ COIN } minted by the Threshold USD Protocol.`}
          >
            {thusdSupply.shorten()}
          </SystemStat>
          {thresholdSelectorStores.map((collateralStore, index) => (
            <SystemStat
              key={index}
              info={`${ collateralStore.store.symbol } Total Collateral Ratio`}
              tooltip={`The Total Collateral Ratio or TCR is the ratio of the Dollar value of the entire system collateral at the current ${collateralStore.store.symbol}:USD price, to the entire system debt. In other words, it's the sum of the collateral of all Troves expressed in USD, divided by the debt of all Troves expressed in thUSD.`}
            >
              {collateralStore.store.totalCollateralRatio.prettify()}
            </SystemStat>
          ))}
          {thresholdSelectorStores.map((collateralStore, index) => (
            <SystemStat
              key={index}
              info={`${ collateralStore.store.symbol } Loan to Value`}
              tooltip={`The Loan to Value is the ratio of the entire system debt to the value of the entire system collateral at the current ${collateralStore.store.symbol}:USD price. In other words, it's the sum of the debt of all Troves expressed in thUSD, divided by the collateral of all Vaults expressed in USD.`}
            >
              {collateralStore.store.loanToValue.prettify()}
            </SystemStat>
          ))}          
          {thresholdSelectorStores.map((collateralStore, index) => {
            return collateralStore.store.total.collateralRatioIsBelowCritical(collateralStore.store.price) 
            && (
                <SystemStat
                  key={index}
                  info={`${ collateralStore.store.symbol } Recovery Mode`}
                  tooltip="Recovery Mode is activated when the Total Collateral Ratio (TCR) falls below 150%. When active, your Vault can be liquidated if its collateral ratio is below the TCR. The maximum collateral you can lose from liquidation is capped at 110% of your Vault's debt. Operations are also restricted that would negatively impact the TCR."
                >
                  <Box color="danger">Yes</Box>
                </SystemStat>
              )
          })}
        </Flex>
        <Box sx={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          rowGap: 3,
          columnGap: 2,
          width: "100%",
          fontSize: "0.9em",
          pt: 4,
          pb: 3
        }}>
          {IsPriceEditable === true &&
            thresholdSelectorStores.map((collateralStore, index) => {
              return <EditPrice key={index} version={collateralStore.version} collateral={collateralStore.collateral} />
            })
          }
        </Box>
        {IsPriceEditable === true &&
            thresholdSelectorStores.map((collateralStore, index) => {
              return <MintErc20 key={index} version={collateralStore.version} collateral={collateralStore.collateral} />
            })
          }
      </Card>
    </Card>
  );
};
