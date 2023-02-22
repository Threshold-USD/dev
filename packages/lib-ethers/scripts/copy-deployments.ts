import fs from "fs";
import path from "path";

// TODO update this script to support multiple collaterals and versions once the front end is updated to support this.
const outputDir = "deployments";
const inputDir = (channel: string, collateralName?: string) =>
  collateralName
    ? path.join("deployments", channel, collateralName, "v1")
    : path.join("deployments", channel);

// Define constants for the different channels that deployment files can come from.
const backfillChannel = "backfill";
const defaultChannel = "default/tst/v1";

// Define a helper function that checks if a directory exists.
const exists = (dir: string) => {
  return fs.existsSync(dir) && fs.lstatSync(dir).isDirectory();
};

// Define a helper function that copies all the deployment files in a directory to the output directory.
const copyDeploymentsFrom = (deploymentsDir: string) => {
  // Get the list of files in the input directory.
  const deployments = fs.readdirSync(deploymentsDir);

  // For each file, copy it to the output directory.
  for (const deployment of deployments) {
    fs.copyFileSync(
      path.join(deploymentsDir, deployment),
      path.join(outputDir, deployment)
    );
  }
};

// Log the deployment channel to the console.
console.log(`Deployment channel: ${process.env.CHANNEL ?? "default"}`);

// Copy deployment files from the backfill channel and the default channel to the output directory.
copyDeploymentsFrom(inputDir(backfillChannel));
copyDeploymentsFrom(inputDir(defaultChannel));

// If a specific deployment channel is set in the environment variable, copy deployment files from that channel to the output directory.
if (process.env.CHANNEL && process.env.CHANNEL !== defaultChannel) {
  const channelDir = inputDir(process.env.CHANNEL);

  // If the channel directory exists, copy its deployment files to the output directory.
  if (exists(channelDir)) {
    copyDeploymentsFrom(channelDir);
  }
}
