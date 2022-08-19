import React, { useState, useEffect } from "react";

import { createClient } from "urql";
import { ChartContext } from "./ChartContext";

type BlockObject = {
  number?: string, 
  __typename?: string
}
const BLOCKS_API_URL = "https://api.thegraph.com/subgraphs/name/blocklytics/goerli-blocks";
const THRESHOLD_USD_API_URL = "https://api.thegraph.com/subgraphs/name/evandrosaturnino/thresholdusd"

const fetchBlockByTimestamp = (timestamp: number) => {
  const query = `
  query {
    blocks(
      first: 1
      orderBy: number, 
      orderDirection: desc, 
      where: {
        timestamp_gte: "${timestamp}", 
        timestamp_lt: "${timestamp + 600}"
      }
    ){
      number
    }
  }
`
  return fetchData(BLOCKS_API_URL, query)
};

const fetchTvlByBlock = (blockNumber: number) => {
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
  }
`
  return fetchData(THRESHOLD_USD_API_URL, query)
};

export const createListOfTimestamps = (): Array<number> => {
  const currentDate = Math.floor((Date.now() / 1000) - 60) // Get a date object for the current time;
  
  const deltaPerPeriod = 86400; // Every 24 hours (in secs)
  const numberOfPeriods = 14; // For 14 days
  const startingTimestamp = currentDate - (deltaPerPeriod * numberOfPeriods); // Set it 14 days ago (in secs)

  const timestamps: Array<number> = [];

  for (let i = 0; i < numberOfPeriods + 1; i++) {
    timestamps.push(startingTimestamp + i * deltaPerPeriod); // [1590969600, 1591056000, ...]
  }; // iterating the period of time to build up an array with the timestamp for each day (in secs)

  return timestamps;
};

export const queryBlocksByTimestamps = async (timestamps: Array<number>): Promise<Array<BlockObject>> => {
  const blocks: BlockObject[] = [];

  for (const timestamp of timestamps) {
    const blocksData = await fetchBlockByTimestamp(timestamp);
    const block: BlockObject = blocksData.data.blocks[0];
    blocks.push(block);
  }; // iterating the timestamps array to query one block for each day
  console.log('blocks: ', blocks);
  return blocks;
};

export const queryTvlByBlocks = async (blocks: Array<BlockObject>): Promise<number[]> => {
  const tvl: Array<number> = [];

  for (const block of blocks) {
    const blockNumber: number = Number(block.number)
    const tvlData = await fetchTvlByBlock(blockNumber);
    const tvlValue: number = tvlData.data ? Number(tvlData.data.systemStates[0].totalCollateral) : 0;
    tvl.push(tvlValue);
    console.log('tvl: ', tvl);
  }; // iterating the blocks array to query the tvl of each day
  return tvl;
};

export const queryTVL = async ():  Promise<Array<number>> => {
  const timestamps: Array<number> = createListOfTimestamps();
  const blocks: BlockObject[] = await queryBlocksByTimestamps(timestamps);
  const tvl: Array<number> = await queryTvlByBlocks(blocks);
  console.log('tvl2: ', tvl);
  return tvl
}

async function fetchData(API_URL: string, query: string) {
  const client = createClient({
    url: API_URL
  });

  const response = await client.query(query).toPromise();
  return response;
}

export const ChartProvider: React.FC = props => {
  const { children } = props;
  const timestamps: Array<number> = createListOfTimestamps();
  const [tvl, setTvl] = useState<Array<number>>([])
  const [isMounted, setIsMounted] = useState<boolean>(true)

  useEffect(() => {
    if (isMounted) {
      console.log('tvl3: ', tvl)
      queryTVL().then(
        (result) => {
          if (!isMounted) return null
          setTvl(result)
          return result
        }
      );
    }
    return () => { 
      setIsMounted(false);
    };
  }, [isMounted, tvl]);

  const provider = {
    tvl,
    timestamps
  };
  return <ChartContext.Provider value={provider}>{children}</ChartContext.Provider>;
};
