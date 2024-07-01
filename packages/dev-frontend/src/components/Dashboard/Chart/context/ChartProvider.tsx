import React, { useState, useEffect } from "react";
import { ChartContext } from "./ChartContext";

import { useThreshold } from "../../../../hooks/ThresholdContext";
import { Decimal } from "@threshold-usd/lib-base";
import { fetchCoinGeckoPrice } from "./fetchCoinGeckoPrice";
import axios from "axios";

export type TimestampsObject = {
  universalTimestamp: number;
  localTimestamp: number;
}

export type BlockObject = {
  number?: string;
  __typename?: string;
};

export type TvlData = {
  totalCollateral: Decimal;
  blockNumber: number;
};

export type Tvl = {
  version: string;
  collateral: string;
  tvl: TvlData[]
};

export type FunctionalPanelProps = {
  loader?: React.ReactNode;
  children?: React.ReactNode;
};

const coingeckoIdsBySymbol = {
  eth: "ethereum",
  tbtc: "tbtc"
}

const subgraphIdsByCollateral = {
  eth: "EHyZHuKyspL8aF37WJBMaKgVBWrD4mNME7VcbzSDgq2o",
  tbtc: "BjbJ8K9nyNUNCGaModhhUjybfYAwX34ngRMhot5yUx6h"
}

const subgraphApiKey = process.env.REACT_APP_SUBGRAPH_API_KEY;

const fetchBlockByTimestamp = (timestamp: number, blocksApiUrl: string) => {
  const query = `
  query {
    blocks(
      first: 1
      orderBy: number, 
      orderDirection: desc, 
      where: {
        timestamp_gte: "${timestamp - 600}", 
        timestamp_lt: "${timestamp}"
      }
    ){
      number
    }
  }`
  return fetchData(blocksApiUrl, query);
};

const fetchTvlByBlock = (blockNumber: number, thresholdUsdApiUrl: string) => {
  const query = `
  query {
    systemStates(
      first: 1
      orderBy: sequenceNumber
      orderDirection: desc
      block: {
        number: ${blockNumber}
      }
    ) {
      totalCollateral
    }
  }`
  return fetchData(thresholdUsdApiUrl, query);
};

export const createListOfTimestamps = (): Array<TimestampsObject> => {
  const currentTimeZoneOffsetInSeconds  = new Date().getTimezoneOffset() * 90;
  const currentDate = Math.floor((Date.now() / 1000) - 60) // Get a date object for the current time;
  const deltaPerPeriod = 86400; // Every 24 hours (in secs)
  const numberOfPeriods = 30; // Period of 30 days
  const startingTimestamp = currentDate - (deltaPerPeriod * numberOfPeriods); // Set it 30 days ago (in secs)
  const timestamps: Array<TimestampsObject> = [];

  for (let i = 0; i < numberOfPeriods + 1; i++) {
    timestamps.push({universalTimestamp: startingTimestamp + i * deltaPerPeriod, localTimestamp: (startingTimestamp + i * deltaPerPeriod) - currentTimeZoneOffsetInSeconds}); // [1590969600, 1591056000, ...]
  }; // iterating the period of time to build up an array with the timestamp for each day (in secs)
  return timestamps;
};

export async function queryBlocksByTimestamps(timestamps: TimestampsObject[], blocksApiUrl: string): Promise<BlockObject[]> {
  const blockPromises = timestamps.map(async (timestamp) => {
    const blocksData = await fetchBlockByTimestamp(timestamp.universalTimestamp, blocksApiUrl);
    return blocksData.data.blocks[0];
  });
  return Promise.all(blockPromises);
}

export const queryTvlByBlocks = async (
  blocks: Array<BlockObject>,
  thresholdUsdApiUrl: string
): Promise<Array<TvlData>> => {
  try {
    // Use map() to transform each block into a Promise that resolves to TvlData
    const tvlData = await Promise.all(
      blocks.map(async (block) => {
        const blockNumber = Number(block.number);

        // Fetch TVL data using the fetchTvlByBlock() function
        const result = await fetchTvlByBlock(blockNumber, thresholdUsdApiUrl);
        
        // Check if the result data contains systemStates; if not, set totalCollateral to 0
        const totalCollateral = result.data?.systemStates[0]?.totalCollateral || 0;
        const decimalTotalCollateral = Decimal.from(totalCollateral);
        return {
          totalCollateral: decimalTotalCollateral,
          blockNumber,
        };
      })
    );
    return tvlData;
  } catch (error) {
    console.error('queryTvlByBlocks error: ', error);
    return [];
  }
};

export const queryTvl = async (blocksApiUrl: string, thresholdUsdApiUrl: string, coingeckoId: string): Promise<Array<TvlData>> => {
  const timestamps: Array<TimestampsObject> = createListOfTimestamps();

  try {
    const blocks = await queryBlocksByTimestamps(timestamps, blocksApiUrl);
    const historicalTvl = await queryTvlByBlocks(blocks, thresholdUsdApiUrl);
    const pricedHistoricalTvl = await calculateTvlPrice(historicalTvl, coingeckoId);

    return pricedHistoricalTvl;
  } catch (error) {
    console.error('queryTvl error: ', error);
    return [];
  }
};

export const calculateTvlPrice = async (historicalTvl: Array<TvlData>, coingeckoId: string): Promise<Array<TvlData>> => {
  // fetch the USD token price from the CoinGecko API
  const { tokenPriceUSD } = await fetchCoinGeckoPrice(coingeckoId);

  // map over the historical TVL data and price each entry in USD
  const pricedHistoricalTvl = historicalTvl.map(({ totalCollateral, blockNumber }) => {
    // multiply the total collateral by the USD token price to get the total value in USD
    const pricedTvl: Decimal = totalCollateral.mul(tokenPriceUSD);

    // return a new TVL entry with the priced total value and the original block number
    return { totalCollateral: pricedTvl, blockNumber };
  });

  // return the priced TVL data
  return pricedHistoricalTvl;
};

async function fetchData(API_URL: string, query: string) {
  try {
    const response = await axios.post(API_URL, { query });
    return response.data;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

export const ChartProvider = ({ children }: FunctionalPanelProps): JSX.Element  => {
  const timestamps: Array<TimestampsObject> = createListOfTimestamps();
  const [isTVLDataAvailable, setisTVLDataAvailable] = useState<boolean>(true);
  const [tvl, setTvl] = useState<Tvl[]>([]);
  const [isMounted, setIsMounted] = useState<boolean>(true);

  const { threshold, config, provider } = useThreshold();
  const { blocksApiUrl, thresholdUsdApiUrl, isUnsupportedNetwork } = config;

  const getTVLData = () => {
    if (isUnsupportedNetwork) {
      console.error(`The network is unsupported in config.json file`);
      setisTVLDataAvailable(false);
      return;
    }

    if (!blocksApiUrl || !thresholdUsdApiUrl || !coingeckoIdsBySymbol) {
      console.error(`You must add a config.json file into the public source folder.`);
      setisTVLDataAvailable(false);
      return;
    }
    
    return provider.getNetwork()
      .then((network) => {
        const networkName = network.name === 'homestead' ? 'mainnet' : network.name;
        const blocksUrlByNetwork = `https://gateway-arbitrum.network.thegraph.com/api/${subgraphApiKey}/subgraphs/id/9A6bkprqEG2XsZUYJ5B2XXp6ymz9fNcn4tVPxMWDztYC`;
        
        for (const thresholdCollateral of threshold) {
          const {collateral, version} = thresholdCollateral
          const thresholdUrlByNetwork = `https://gateway-arbitrum.network.thegraph.com/api/${subgraphApiKey}/subgraphs/id/${subgraphIdsByCollateral[collateral as keyof typeof subgraphIdsByCollateral]}`;

          queryTvl(blocksUrlByNetwork, thresholdUrlByNetwork, (coingeckoIdsBySymbol as {[key: string]: string})[collateral])
            .then((result) => {
              setTvl((prev) => { return [...prev, {
                  collateral: collateral,
                  version: version,
                  tvl: result
                }]
              });
            })
            .catch((error) => {
              setisTVLDataAvailable(false);
              console.error('failed to fetch tvl: ', error);
            });
        }
      })
      .catch((error) => {
        setisTVLDataAvailable(false);
        console.error('failed to fetch tvl: ', error);
      });
  };
  
  useEffect(() => {
    if (!isMounted) {
      return;
    }
    getTVLData();

    return () => {
      setIsMounted(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]);

  if (isUnsupportedNetwork) return <ChartContext.Provider value={{ isUnsupportedNetwork }}>{children}</ChartContext.Provider>;

  if (!isTVLDataAvailable || !timestamps || tvl.length !== threshold.length) {
    return <>{children}</>
  };

  const chartProvider = {
    tvl,
    timestamps,
    isUnsupportedNetwork: false,
  };
  
  return <ChartContext.Provider value={chartProvider}>{children}</ChartContext.Provider>;
};
