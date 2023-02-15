import React, { useState, useEffect } from "react";

import { createClient } from "urql";
import { ChartContext } from "./ChartContext";

import { useThreshold } from "../../../../hooks/ThresholdContext";
import { Decimal } from "@liquity/lib-base";
import { fetchCoinGeckoPrice } from "./fetchCoinGeckoPrice";

export type TimestampsObject = {
  universalTimestamp: number, 
  localTimestamp: number
}
export type BlockObject = {
  number?: string, 
  __typename?: string
};
export type tvlData = {
  totalCollateral: Decimal, 
  blockNumber: number
};
export type FunctionalPanelProps = {
  loader?: React.ReactNode;
  children: React.ReactNode;
};

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

export const queryBlocksByTimestamps = async (timestamps: Array<TimestampsObject>, blocksApiUrl: string): Promise<Array<BlockObject>> => {
  const Blocks = timestamps.map(async (timestamp): Promise<BlockObject> => {
    const blocksData = await fetchBlockByTimestamp(timestamp.universalTimestamp, blocksApiUrl)
    return blocksData.data.blocks[0];
  })
  return Promise.all(Blocks);
};

export const queryTvlByBlocks = async (blocks: Array<BlockObject>, thresholdUsdApiUrl: string): Promise<Array<tvlData>> => {
  const tvlData = blocks.map(async (block) => {
    const blockNumber: number = Number(block.number);
    return fetchTvlByBlock(blockNumber, thresholdUsdApiUrl)
      .then((result) => {
        if (!result.data?.systemStates[0]) {
          return { totalCollateral: Decimal.from(0), blockNumber }
        }
        const { totalCollateral } = result.data.systemStates[0]
        const parsedTotalCollateral = parseInt(totalCollateral)

        return {totalCollateral: Decimal.from(parsedTotalCollateral), blockNumber}
      })
      .catch((error) => {
        console.error('queryTvlByBlocks error: ', error)
        return { totalCollateral: Decimal.from(0), blockNumber }
      })
  });

  return Promise.all(tvlData);
};

export const queryTvl = async (blocksApiUrl: string, thresholdUsdApiUrl: string, coingeckoId: string):  Promise<Array<tvlData>> => {
  const timestamps: Array<TimestampsObject> = createListOfTimestamps();
  return queryBlocksByTimestamps(timestamps, blocksApiUrl)
    .then(
      async (blocks) => {
        const historicalTvl = await queryTvlByBlocks(blocks, thresholdUsdApiUrl);
        const pricedHistoricalTvl = await calculateTvlPrice(historicalTvl, coingeckoId)
        return pricedHistoricalTvl;
      }
    )
};

export const calculateTvlPrice = async (historicalTvl: Array<tvlData>, coingeckoId: string): Promise<Array<tvlData>> => {
  const { tokenPriceUSD } = await fetchCoinGeckoPrice(coingeckoId);
  const pricedHistoricalTvl = historicalTvl.map((tvl) => {
    const { totalCollateral, blockNumber } = tvl
    const pricedTvl = totalCollateral.mul(tokenPriceUSD)
    return { totalCollateral: pricedTvl, blockNumber }
  })
  return pricedHistoricalTvl;
};

async function fetchData(API_URL: string, query: string) {
  const client = createClient({
    url: API_URL
  });
  const response = await client.query(query).toPromise();
  return response;
};

export const ChartProvider = ({ children }: FunctionalPanelProps): JSX.Element  => {
  const timestamps: Array<TimestampsObject> = createListOfTimestamps();
  const [ isTVLDataAvailable , setisTVLDataAvailable ] = useState<boolean>(true);
  const [ tvl, setTvl ] = useState<{ [key: string]: tvlData[] }>({});
  const [ isMounted, setIsMounted ] = useState<boolean>(true);
  const { threshold, config, provider } = useThreshold();
  const { blocksApiUrl, thresholdUsdApiUrl, coingeckoIdsByVersion } = config;

  const getTVLData = () => {
    if (!blocksApiUrl || !thresholdUsdApiUrl || !coingeckoIdsByVersion) {
      console.error(`You must add a config.json file into the public source folder.`)
      setisTVLDataAvailable(false)
      return;
    }
    return provider.getNetwork()
      .then((network) => {
        const networkName = network.name === 'homestead' ? 'ethereum' : network.name;
        const blocksUrlByNetwork = `https://${blocksApiUrl}/${networkName}-blocks`;
        for (const [version] of Object.entries(threshold)) {
          const thresholdUrlByNetwork = `https://${thresholdUsdApiUrl}/${version}-${networkName}-thresholdusd`;
          queryTvl(blocksUrlByNetwork, thresholdUrlByNetwork, (coingeckoIdsByVersion as {[key: string]: string})[version])
            .then((result) => {
              setTvl((prev) => { return {...prev, [version]: result} })
            })
        }
      })
      .catch((error) => {
        setisTVLDataAvailable(false);
        console.error('failed to fetch tvl: ', error);
      });
    }
  
  useEffect(() => {
    if (!isMounted) {
      return
    };

    getTVLData();
    return () => {
      setIsMounted(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]);

  if (!isTVLDataAvailable || !timestamps || Object.keys(tvl).length !== Object.keys(threshold).length) {
    return <>{children}</>
  };

  const chartProvider = {
    tvl,
    timestamps
  };
  
  return <ChartContext.Provider value={chartProvider}>{children}</ChartContext.Provider>;
};
