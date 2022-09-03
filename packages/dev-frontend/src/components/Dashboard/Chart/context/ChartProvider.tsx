import React, { useState, useEffect } from "react";

import { createClient } from "urql";
import { ChartContext } from "./ChartContext";

import { useLiquity } from "../../../../hooks/LiquityContext";

export type BlockObject = {
  number?: string, 
  __typename?: string
};

export type tvlData = {
  totalCollateral: number, 
  blockNumber: number
};

export type FunctionalPanelProps = {
  loader?: React.ReactNode;
};

const fetchBlockByTimestamp = (timestamp: number, BlocksApiUrl: string) => {
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

  return fetchData(BlocksApiUrl, query);
};

const fetchTvlByBlock = (blockNumber: number, ThresholdUsdApiUrl: string) => {
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

  return fetchData(ThresholdUsdApiUrl, query);
};

export const createListOfTimestamps = (): Array<number> => {
  const currentDate = Math.floor((Date.now() / 1000) - 120) // Get a date object for the current time;
  const deltaPerPeriod = 86400; // Every 24 hours (in secs)
  const numberOfPeriods = 30; // For 30 days
  const startingTimestamp = currentDate - (deltaPerPeriod * numberOfPeriods); // Set it 30 days ago (in secs)
  const timestamps: Array<number> = [];

  for (let i = 0; i < numberOfPeriods + 1; i++) {
    timestamps.push(startingTimestamp + i * deltaPerPeriod); // [1590969600, 1591056000, ...]
  }; // iterating the period of time to build up an array with the timestamp for each day (in secs)

  return timestamps;
};

export const queryBlocksByTimestamps = async (timestamps: Array<number>, BlocksApiUrl: string): Promise<Array<BlockObject>> => {
  const blocks: Array<BlockObject> = [];

  for (const timestamp of timestamps) {
    const blocksData = await fetchBlockByTimestamp(timestamp, BlocksApiUrl);
    const block: BlockObject = blocksData.data.blocks[0];
    blocks.push(block);
  }; // iterating the timestamps array to query one block for each day

  return blocks;
};

export const queryTvlByBlocks = async (blocks: Array<BlockObject>, ThresholdUsdApiUrl: string): Promise<Array<tvlData>> => {
  const tvlData = blocks.map(async (block) => {
    const blockNumber: number = Number(block.number);
    
    return fetchTvlByBlock(blockNumber, ThresholdUsdApiUrl).then((result) => {
      const tvlValue: tvlData = result.data ? {
        totalCollateral: Number(result.data.systemStates[0].totalCollateral), 
        blockNumber: blockNumber
      } : {
        totalCollateral: 0, 
        blockNumber: blockNumber
      };
      return tvlValue;
    });
  });

  return Promise.all(tvlData)
};

export const queryTVL = async (BlocksApiUrl: string, ThresholdUsdApiUrl: string):  Promise<Array<tvlData>> => {
  const timestamps: Array<number> = createListOfTimestamps();
  return await queryBlocksByTimestamps(timestamps, BlocksApiUrl).then(
    async (blocks) => {
      const tvl = await queryTvlByBlocks(blocks, ThresholdUsdApiUrl);
      return tvl;
    }
  );
};

async function fetchData(API_URL: string, query: string) {
  const client = createClient({
    url: API_URL
  });
  const response = await client.query(query).toPromise();
  return response;
};

export const ChartProvider: React.FC<FunctionalPanelProps> = ({ children, loader })  => {
  const timestamps: Array<number> = createListOfTimestamps();
  const [tvl, setTvl] = useState<Array<tvlData>>();
  const [isMounted, setIsMounted] = useState<boolean>(true);

  const { config, provider } = useLiquity();
  const { BlocksApiUrl, ThresholdUsdApiUrl } = config;

  useEffect(() => {
    if (isMounted) {
      provider.getNetwork().then((network) => {
        const networkName = network.name === 'homestead' ? 'ethereum' : network.name;
        const BlocksUrlByNetwork = `https://${BlocksApiUrl}/${networkName}-blocks`;
        const ThresholdUrlByNetwork = `https://${ThresholdUsdApiUrl}/${networkName}-thresholdusd`;

        queryTVL(BlocksUrlByNetwork, ThresholdUrlByNetwork).then(
        (result) => {
          if (!isMounted) return null;
          setTvl(result);
          return tvl;
        }
      )});
    }
    return () => { 
      setIsMounted(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]);

  if (!timestamps || !tvl) {
    return <>{loader}</>
  };

  const chartProvider = {
    tvl,
    timestamps
  };
  
  return <ChartContext.Provider value={chartProvider}>{children}</ChartContext.Provider>;
};
