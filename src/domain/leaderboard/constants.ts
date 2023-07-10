import { ARBITRUM, ARBITRUM_GOERLI, AVALANCHE } from "config/chains";

export const CURRENT_COMPETITION_INDEX = {
  [ARBITRUM_GOERLI]: 0,
  [AVALANCHE]: null,
  [ARBITRUM]: null,
};

export const ALL_COMPETITIONS = {
  [ARBITRUM_GOERLI]: [
    {
      index: 0,
      name: "Rush 1",
    },
  ],
  [AVALANCHE]: [],
  [ARBITRUM]: [],
};

export const LEADERBOARD_SELECTED_TAB_KEY = "Leaderboard-selected-tab-key";
export const LEADERBOARD_SELECTED_COMPETITION = "Leaderboard-selected-competition";

export const ARBITRUM_TESTNET_GRAPH = "https://api.thegraph.com/subgraphs/name/morazzela/gmx-arbitrum-test-leaderboard";
export const GRAPHS = {
  [ARBITRUM_GOERLI]: ARBITRUM_TESTNET_GRAPH,
  [AVALANCHE]: ARBITRUM_TESTNET_GRAPH,
  [ARBITRUM]: ARBITRUM_TESTNET_GRAPH,
};

export function getCurrentCompetitionIndex(chainId) {
  return CURRENT_COMPETITION_INDEX[chainId];
}

export enum Period {
  day,
  week,
  month,
}
