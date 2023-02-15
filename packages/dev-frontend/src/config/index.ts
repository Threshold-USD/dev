export type ThresholdConfig = {
  coingeckoIdsByVersion?: object
  infuraApiKey?: string;
  testnetOnly?: boolean;
  blocksApiUrl?: string;
  thresholdUsdApiUrl?: string;
};

const defaultConfig: ThresholdConfig = {
};

function hasKey<K extends string>(o: object, k: K): o is Record<K, unknown> {
  return k in o;
}

const parseConfig = (json: unknown): ThresholdConfig => {
  const config = { ...defaultConfig };

  if (typeof json === "object" && json !== null) {
    if (hasKey(json, "coingeckoIdsByVersion") && typeof json.coingeckoIdsByVersion === "object" && json.coingeckoIdsByVersion !== null) {
      const { coingeckoIdsByVersion } = json;
      config.coingeckoIdsByVersion = coingeckoIdsByVersion;
    } else {
      console.error("Malformed infuraApiKey:");
    }

    if (hasKey(json, "infuraApiKey") && json.infuraApiKey !== "") {
      const { infuraApiKey } = json;
      if (typeof infuraApiKey === "string") {
        config.infuraApiKey = infuraApiKey;
      } else {
        console.error("Malformed infuraApiKey:");
        console.log(infuraApiKey);
      }
    }

    if (hasKey(json, "testnetOnly")) {
      const { testnetOnly } = json;

      if (typeof testnetOnly === "boolean") {
        config.testnetOnly = testnetOnly;
      } else {
        console.error("Malformed testnetOnly:");
        console.log(testnetOnly);
      }
    }

    if (hasKey(json, "blocksApiUrl") && json.blocksApiUrl !== "") {
      const { blocksApiUrl } = json;
      if (typeof blocksApiUrl === "string") {
        config.blocksApiUrl = blocksApiUrl;
      } else {
        console.error("Malformed blocksApiUrl:");
        console.log(blocksApiUrl);
      }
    }

    if (hasKey(json, "thresholdUsdApiUrl") && json.thresholdUsdApiUrl !== "") {
      const { thresholdUsdApiUrl } = json;

      if (typeof thresholdUsdApiUrl === "string") {
        config.thresholdUsdApiUrl = thresholdUsdApiUrl;
      } else {
        console.error("Malformed thresholdUsdApiUrl:");
        console.log(thresholdUsdApiUrl);
      }
    }
  } else {
    console.error("Malformed config:");
    console.log(json);
  }

  return config;
};

let configPromise: Promise<ThresholdConfig> | undefined = undefined;

const fetchConfig = async () => {
  try {
    const response = await fetch("config.json");

    if (!response.ok) {
      throw new Error(`Failed to fetch config.json (status ${response.status})`);
    }

    return parseConfig(await response.json());
  } catch (err) {
    console.error(err);
    return { ...defaultConfig };
  }
};

export const getConfig = (): Promise<ThresholdConfig> => {
  if (!configPromise) {
    configPromise = fetchConfig();
  }

  return configPromise;
};
