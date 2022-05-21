import React, { useState, useEffect, useCallback } from "react";
import { Box, Button, Card, Container, Flex, Image, Link, Text  } from "theme-ui";

import {
  Percent,
  MINIMUM_COLLATERAL_RATIO,
  CRITICAL_COLLATERAL_RATIO,
  UserTrove,
  Decimal
} from "@liquity/lib-base";
import { BlockPolledLiquityStoreState } from "@liquity/lib-ethers";
import { useLiquitySelector } from "@liquity/lib-react";
import { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";

import { shortenAddress } from "../utils/shortenAddress";
import { useLiquity } from "../hooks/LiquityContext";
import { COIN } from "../strings";

import { Icon } from "./Icon";
import { LoadingOverlay } from "./LoadingOverlay";
import { Transaction } from "./Transaction";
import { Tooltip } from "./Tooltip";
import { Abbreviation } from "./Abbreviation";

const rowHeight = "40px";

const liquidatableInNormalMode = (trove: UserTrove, price: Decimal) =>
  [trove.collateralRatioIsBelowMinimum(price), "Collateral ratio not low enough"] as const;

const liquidatableInRecoveryMode = (
  trove: UserTrove,
  price: Decimal,
  totalCollateralRatio: Decimal,
  lusdInStabilityPool: Decimal
) => {
  const collateralRatio = trove.collateralRatio(price);

  if (collateralRatio.gte(MINIMUM_COLLATERAL_RATIO) && collateralRatio.lt(totalCollateralRatio)) {
    return [
      trove.debt.lte(lusdInStabilityPool),
      "There's not enough LUSD in the Stability pool to cover the debt"
    ] as const;
  } else {
    return liquidatableInNormalMode(trove, price);
  }
};

type RiskyVaultsProps = {
  pageSize: number;
};

const select = ({
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  blockTag
}: BlockPolledLiquityStoreState) => ({
  numberOfTroves,
  price,
  recoveryMode: total.collateralRatioIsBelowCritical(price),
  totalCollateralRatio: total.collateralRatio(price),
  lusdInStabilityPool,
  blockTag
});

export const RiskyVaults: React.FC<RiskyVaultsProps> = ({ pageSize }) => {
  const { chainId } = useWeb3React<Web3Provider>();
  console.log('chainId: ', chainId)
  const {
    blockTag,
    numberOfTroves,
    recoveryMode,
    totalCollateralRatio,
    lusdInStabilityPool,
    price
  } = useLiquitySelector(select);
  const { liquity } = useLiquity();

  const [loading, setLoading] = useState(true);
  const [troves, setTroves] = useState<UserTrove[]>();

  const [reload, setReload] = useState({});
  const forceReload = useCallback(() => setReload({}), []);

  const [page, setPage] = useState(0);
  const numberOfPages = Math.ceil(numberOfTroves / pageSize) || 1;
  const clampedPage = Math.min(page, numberOfPages - 1);

  const nextPage = () => {
    if (clampedPage < numberOfPages - 1) {
      setPage(clampedPage + 1);
    }
  };

  const previousPage = () => {
    if (clampedPage > 0) {
      setPage(clampedPage - 1);
    }
  };

  useEffect(() => {
    if (page !== clampedPage) {
      setPage(clampedPage);
    }
  }, [page, clampedPage]);

  useEffect(() => {
    let mounted = true;

    setLoading(true);

    liquity
      .getTroves(
        {
          first: pageSize,
          sortedBy: "ascendingCollateralRatio",
          startingAt: clampedPage * pageSize
        },
        { blockTag }
      )
      .then(troves => {
        if (mounted) {
          setTroves(troves);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
    // Omit blockTag from deps on purpose
    // eslint-disable-next-line
  }, [liquity, clampedPage, pageSize, reload]);

  useEffect(() => {
    forceReload();
  }, [forceReload, numberOfTroves]);

  const [copied, setCopied] = useState<string>();

  useEffect(() => {
    if (copied !== undefined) {
      let cancelled = false;

      setTimeout(() => {
        if (!cancelled) {
          setCopied(undefined);
        }
      }, 2000);

      return () => {
        cancelled = true;
      };
    }
  }, [copied]);

  return (
    <Container sx={{ pr: "2rem" }}>
      <Card variant="mainCards">
        <Card variant="layout.columns">
          <Flex sx={{
            justifyContent: "space-between",
            alignItems: "center",
            flexDirection: "row",
            width: "100%",
            pb: "1em",
            borderBottom: 1, 
            borderColor: "border"
          }}>
            <Box>
              Risky Vaults
            </Box>
            <Flex sx={{ alignItems: "center" }}>
              {numberOfTroves !== 0 && (
                <>
                  <Abbreviation
                    short={`page ${clampedPage + 1} / ${numberOfPages}`}
                    sx={{ mr: 2, fontWeight: "body", fontSize: 1, letterSpacing: 0 }}
                  >
                    {clampedPage * pageSize + 1}-{Math.min((clampedPage + 1) * pageSize, numberOfTroves)}{" "}
                    of {numberOfTroves}
                  </Abbreviation>

                  <Button variant="titleIcon" onClick={previousPage} disabled={clampedPage <= 0}>
                    <Icon name="chevron-left" size="sm" />
                  </Button>

                  <Button
                    variant="titleIcon"
                    onClick={nextPage}
                    disabled={clampedPage >= numberOfPages - 1}
                  >
                    <Icon name="chevron-right" size="sm" />
                  </Button>
                </>
              )}
            </Flex>
          </Flex>

          {!troves || troves.length === 0 ? (
            <Box sx={{ p: [2, 3] }}>
              <Box sx={{ p: 4, fontSize: 3, textAlign: "center" }}>
                {!troves ? "Loading..." : "There are no Troves yet"}
              </Box>
            </Box>
          ) : (
            <Box sx={{ width:"100%", p: [2, 3] }}>
              <Box
                as="table"
                sx={{
                  mt: 2,
                  width: "100%",

                  textAlign: "left",
                  lineHeight: 1.15
                }}
              >
                <colgroup>
                  <col style={{ width: "30%" }} />
                  <col />
                  <col />
                  <col />
                  <col style={{ width: rowHeight }} />
                </colgroup>

                <thead>
                  <tr style={{ opacity: 0.6 }}>
                    <th style={{ verticalAlign: "top" }}>Owner</th>
                    <th>
                      <Abbreviation short="Coll.">Collateral</Abbreviation>
                      <Box sx={{ fontSize: [0, 1], fontWeight: "body" }}>ETH</Box>
                    </th>
                    <th>
                      Debt
                      <Box sx={{ fontSize: [0, 1], fontWeight: "body" }}>{COIN}</Box>
                    </th>
                    <th>
                      Coll.
                      <br />
                      Ratio
                    </th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {troves.map(
                    trove =>
                      !trove.isEmpty && ( // making sure the Trove hasn't been liquidated
                        // (TODO: remove check after we can fetch multiple Troves in one call)
                        <tr key={trove.ownerAddress} 
                          style={{
                            fontWeight: "bold"
                          }}>
                          <td
                            style={{
                              display: "flex",
                              alignItems: "center",
                              height: rowHeight,
                            }}
                          >
                            <Tooltip message={trove.ownerAddress} placement="top">
                              <Text
                                variant="address"
                                sx={{
                                  width: ["73px", "unset"],
                                  overflow: "hidden",
                                  position: "relative"
                                }}
                              >
                                {shortenAddress(trove.ownerAddress)}
                                <Box
                                  sx={{
                                    display: ["block", "none"],
                                    position: "absolute",
                                    top: 0,
                                    right: 0,
                                    width: "50px",
                                    height: "100%",
                                    background:
                                      "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)"
                                  }}
                                />
                              </Text>
                            </Tooltip>
                            <Link 
                              variant="socialIcons" 
                              href={(chainId === 3 && `https://ropsten.etherscan.io/address/${trove.ownerAddress}`) ||
                                `https://etherscan.io/address/${trove.ownerAddress})`} 
                              target="_blank"
                            >
                              <Image src="./icons/external-link.svg" />
                            </Link>
                          </td>
                          <td>
                            <Abbreviation short={trove.collateral.shorten()}>
                              {trove.collateral.prettify(4)}
                            </Abbreviation>
                          </td>
                          <td>
                            <Abbreviation short={trove.debt.shorten()}>
                              {trove.debt.prettify()}
                            </Abbreviation>
                          </td>
                          <td>
                            {(collateralRatio => (
                              <Text
                                color={
                                  collateralRatio.gt(CRITICAL_COLLATERAL_RATIO)
                                    ? "success"
                                    : collateralRatio.gt(1.2)
                                    ? "warning"
                                    : "danger"
                                }
                              >
                                {new Percent(collateralRatio).prettify()}
                              </Text>
                            ))(trove.collateralRatio(price))}
                          </td>
                          <td>
                            <Transaction
                              id={`liquidate-${trove.ownerAddress}`}
                              tooltip="Liquidate"
                              requires={[
                                recoveryMode
                                  ? liquidatableInRecoveryMode(
                                      trove,
                                      price,
                                      totalCollateralRatio,
                                      lusdInStabilityPool
                                    )
                                  : liquidatableInNormalMode(trove, price)
                              ]}
                              send={liquity.send.liquidate.bind(liquity.send, trove.ownerAddress)}
                            >
                              <Button variant="dangerIcon">
                                <Icon name="trash" />
                              </Button>
                            </Transaction>
                          </td>
                        </tr>
                      )
                  )}
                </tbody>
              </Box>
            </Box>
          )}

          {loading && <LoadingOverlay />}
        </Card>
      </Card>
    </Container>  
  );
};
