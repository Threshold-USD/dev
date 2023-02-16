import React, { useState, useEffect } from "react";

import axios from "axios";
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
): Promise<Array<tvlData>> => {
  try {
    // Use map() to transform each block into a Promise that resolves to tvlData
    const tvlData = await Promise.all(
      blocks.map(async (block) => {
        const blockNumber = Number(block.number);

        // Fetch TVL data using the fetchTvlByBlock() function
        const result = await fetchTvlByBlock(blockNumber, thresholdUsdApiUrl);

        // Check if the result data contains systemStates; if not, set totalCollateral to 0
        const totalCollateral = result.data?.systemStates[0]?.totalCollateral || 0;

        // Convert totalCollateral to an integer and create a Decimal instance for it
        const decimalTotalCollateral = Decimal.from(parseInt(totalCollateral));

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

export const queryTvl = async (blocksApiUrl: string, thresholdUsdApiUrl: string, coingeckoId: string): Promise<Array<tvlData>> => {
  // Get an array of timestamps for the past 30 days.
  const timestamps: Array<TimestampsObject> = createListOfTimestamps();

  try {
    // Query blocks by timestamps.
    const blocks = await queryBlocksByTimestamps(timestamps, blocksApiUrl);

    // Query TVL by blocks.
    const historicalTvl = await queryTvlByBlocks(blocks, thresholdUsdApiUrl);

    // Calculate TVL price based on coingecko ID.
    const pricedHistoricalTvl = await calculateTvlPrice(historicalTvl, coingeckoId);

    // Return the priced historical TVL.
    return pricedHistoricalTvl;
  } catch (error) {
    console.error('queryTvl error: ', error);
    return [];
  }
};

export const calculateTvlPrice = async (historicalTvl: Array<tvlData>, coingeckoId: string): Promise<Array<tvlData>> => {
  // fetch the USD token price from the CoinGecko API
  const { tokenPriceUSD } = await fetchCoinGeckoPrice(coingeckoId);

  // map over the historical TVL data and price each entry in USD
  const pricedHistoricalTvl = historicalTvl.map(({ totalCollateral, blockNumber }) => {
    // multiply the total collateral by the USD token price to get the total value in USD
    const pricedTvl = totalCollateral.mul(tokenPriceUSD);

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
  // Define the state variables for the component using useState hook
  const [isTVLDataAvailable, setisTVLDataAvailable] = useState<boolean>(true);
  const [tvl, setTvl] = useState<{ [key: string]: tvlData[] }>({});
  const [isMounted, setIsMounted] = useState<boolean>(true);

  // Destructure values from useThreshold hook
  const { threshold, config, provider } = useThreshold();
  const { blocksApiUrl, thresholdUsdApiUrl, coingeckoIdsByVersion } = config;

  // Define the getTVLData function for fetching TVL data
  const getTVLData = () => {
    // Check if the required config properties are present
    if (!blocksApiUrl || !thresholdUsdApiUrl || !coingeckoIdsByVersion) {
      console.error(`You must add a config.json file into the public source folder.`);
      setisTVLDataAvailable(false);
      return;
    }

    // Get the network name and corresponding blocks URL
    return provider.getNetwork()
      .then((network) => {
        const networkName = network.name === 'homestead' ? 'ethereum' : network.name;
        const blocksUrlByNetwork = `https://${blocksApiUrl}/${networkName}-blocks`;
        
        // Loop through the versions in the threshold object and fetch the TVL data for each version
        for (const [version] of Object.entries(threshold)) {
          const thresholdUrlByNetwork = `https://${thresholdUsdApiUrl}/${version}-${networkName}-thresholdusd`;
          queryTvl(blocksUrlByNetwork, thresholdUrlByNetwork, (coingeckoIdsByVersion as {[key: string]: string})[version])
            .then((result) => {
              setTvl((prev) => { return {...prev, [version]: result} });
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
  
  // Use the useEffect hook to fetch TVL data only once when the component mounts
  useEffect(() => {
    if (!isMounted) {
      return;
    }

    getTVLData();

    // Clean up function to set isMounted to false when the component unmounts
    return () => {
      setIsMounted(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]);

  // Return the children wrapped in ChartContext.Provider if TVL data is available
  if (!isTVLDataAvailable || !timestamps || Object.keys(tvl).length !== Object.keys(threshold).length) {
    return <>{children}</>
  };

  const chartProvider = {
    tvl,
    timestamps
  };
  
  return <ChartContext.Provider value={chartProvider}>{children}</ChartContext.Provider>;
};
