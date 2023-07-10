import { ApolloClient, InMemoryCache } from "@apollo/client";
import { GRAPHS } from "./constants";

export function getGraphClient(chainId) {
  const graphUrl = GRAPHS[chainId];

  if (!graphUrl) {
    throw new Error("Unsupported chain " + chainId);
  }

  return new ApolloClient({
    uri: graphUrl,
    cache: new InMemoryCache(),
  });
}

export function getNissohGraphClient(chainId) {
  const graphUrl = "https://api.thegraph.com/subgraphs/name/nissoh/gmx-arbitrum";

  if (!graphUrl) {
    throw new Error("Unsupported chain " + chainId);
  }

  return new ApolloClient({
    uri: graphUrl,
    cache: new InMemoryCache(),
  });
}
