# Threshold USD Subgraph

Contains the entities and dependencies to populate a subgraph for Threshold USD protocol.


# Development quickstart
You need to run a Graph Node locally.

1. Clone Graph Node: `git clone https://github.com/graphprotocol/graph-node`
2. Move into the docker directory: `cd graph-node/docker`
3. Start Graph Node docker instance: `docker-compose up -d`
4. Read the logs from your Graph Node: `docker ps | grep graph-node | cut -f 1 -d ' ' | xargs docker logs -f`
5. Start your local Threshold USD dev chain: `cd your_thresholdusd_repo_path && yarn start-dev-chain`
6. Compile Threshold USD subgraph: `yarn prepare:subgraph && yarn build:subgraph`
7. Deploy Threshold USD subgraph to your Graph Node: `cd packages/subgraph && yarn prepare-local && yarn create-local && yarn deploy-local`
8. Open Graph Node graphql API instance in your browser: `http://127.0.0.1:8000/subgraphs/name/liquity/liquity`
9. Open Threshold USD in your browser: `http://localhost:3000`

# Making subgraph code changes
Having done all of the above, if you make subgraph code changes you'll need to run the following:
1. Recompile local changes: `yarn prepare:subgraph && yarn build:subgraph`
2. Redeploy local changes: `cd packages/subgraph && yarn prepare-local && yarn create-local && yarn deploy-local`

# Gotchas

## Stopping and starting dev chain
If you stop and start your local dev chain you need to redeploy your subgraph because the contract addresses will have changed.
