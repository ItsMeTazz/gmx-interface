import { AccountPositionsSummary, AccountScores, PerfPeriod, PositionScores, PositionsSummaryByAccount } from "./types";
import { useAccountPerf, usePositionScores } from "./index";
import { BigNumber } from "ethers";
import { expandDecimals } from "lib/numbers";
import { USD_DECIMALS } from "lib/legacy";

const defaultSummary = (account: string): AccountPositionsSummary => ({
  account,
  unrealizedPnl: BigNumber.from(0),
  sumSize: BigNumber.from(0),
  sumCollateral: BigNumber.from(0),
  sumMaxSize: BigNumber.from(0),
  totalCollateral: BigNumber.from(0),
  priceImpactUsd: BigNumber.from(0),
  collectedBorrowingFeesUsd: BigNumber.from(0),
  collectedFundingFeesUsd: BigNumber.from(0),
  collectedPositionFeesUsd: BigNumber.from(0),
  closingFeeUsd: BigNumber.from(0),
  pendingFundingFeesUsd: BigNumber.from(0),
  pendingClaimableFundingFeesUsd: BigNumber.from(0),
  pendingBorrowingFeesUsd: BigNumber.from(0),
  openPositionsCount: 0,
});

const groupPositionsByAccount = (positions: Array<PositionScores>): PositionsSummaryByAccount => {
  const groupping: PositionsSummaryByAccount = {};
  const groupping2: PositionsSummaryByAccount = {};

  for (const p of positions) {
    const { account } = p;

    if (!groupping[account]) {
      groupping[account] = defaultSummary(account);
    }
    if (!groupping2[account]) {
      groupping2[account] = defaultSummary(account);
    }

    const summary = groupping[account];

    summary.openPositionsCount++;

    summary.unrealizedPnl = summary.unrealizedPnl.add(p.unrealizedPnl);
    summary.sumSize = summary.sumSize.add(p.sizeInUsd)
    summary.sumCollateral = summary.sumCollateral.add(p.collateralAmountUsd);
    summary.sumMaxSize = summary.sumMaxSize.add(p.maxSize);
    summary.totalCollateral = summary.totalCollateral.add(p.collateralAmountUsd);
    summary.collectedBorrowingFeesUsd = summary.collectedBorrowingFeesUsd.add(p.borrowingFeeUsd);
    summary.collectedFundingFeesUsd = summary.collectedFundingFeesUsd.add(p.fundingFeeUsd);
    summary.collectedPositionFeesUsd = summary.collectedPositionFeesUsd.add(p.positionFeeUsd);
    summary.priceImpactUsd = summary.priceImpactUsd.add(p.priceImpactUsd);
    summary.closingFeeUsd = summary.closingFeeUsd.add(p.info.closingFeeUsd);
    summary.pendingFundingFeesUsd = summary.pendingFundingFeesUsd.add(p.info.pendingFundingFeesUsd);
    summary.pendingClaimableFundingFeesUsd = summary.pendingClaimableFundingFeesUsd.add(p.info.pendingClaimableFundingFeesUsd);
    summary.pendingBorrowingFeesUsd = summary.pendingBorrowingFeesUsd.add(p.info.pendingBorrowingFeesUsd);
  }

  return groupping;
};

export function useTopAccounts(period: PerfPeriod) {
  const accountPerf = useAccountPerf(period);
  const positions = usePositionScores();

  if (accountPerf.error || positions.error) {
    return { data: [], isLoading: false, error: accountPerf.error || positions.error };
  } else if (accountPerf.isLoading || positions.isLoading) {
    return { data: [], isLoading: true, error: null };
  }

  const data: Array<AccountScores> = []
  const openPositionsByAccount: Record<string, AccountPositionsSummary> = groupPositionsByAccount(positions.data);

  for (let i = 0; i < accountPerf.data.length; i++) {
    const perf = accountPerf.data[i];
    const openPositions = openPositionsByAccount[perf.account] || defaultSummary(perf.account);
    const totalPnl = perf.totalPnl
      .sub(openPositions.collectedBorrowingFeesUsd)
      .sub(openPositions.collectedFundingFeesUsd)
      .sub(openPositions.collectedPositionFeesUsd)
      .add(openPositions.priceImpactUsd);

    const unrealizedPnl = openPositions.unrealizedPnl
      .sub(openPositions.pendingBorrowingFeesUsd)
      .sub(openPositions.pendingFundingFeesUsd)
      .sub(openPositions.closingFeeUsd);

    const profit = totalPnl.add(unrealizedPnl);
    const maxCollateral = perf.maxCollateral;
    if (maxCollateral.isZero()) {
      throw new Error(`Account ${perf.account} max collateral is 0, please verify data integrity`);
    }
    const relPnl = profit.mul(expandDecimals(1, USD_DECIMALS)).div(maxCollateral);
    const cumsumCollateral = perf.cumsumCollateral;
    const cumsumSize = perf.cumsumSize;

    if (cumsumCollateral.isZero()) {
      throw new Error(`Account ${perf.account} collateral history is 0, please verify data integrity`);
    }

    const sumMaxSize = perf.sumMaxSize.add(openPositions.sumMaxSize);
    const positionsCount = perf.closedCount.add(BigNumber.from(openPositions.openPositionsCount));
    const leverage = cumsumSize.mul(expandDecimals(1, USD_DECIMALS)).div(cumsumCollateral);
    const size = sumMaxSize.div(positionsCount);
    const scores = {
      id: perf.account + ":" + period,
      account: perf.account,
      absPnl: profit,
      relPnl,
      size,
      leverage,
      wins: perf.wins,
      losses: perf.losses,
    };

    data.push(scores);
  }

  const orderedData: Array<AccountScores> = data.sort((a, b) => a.absPnl.gt(b.absPnl) ? -1 : 1);

  return { isLoading: false, error: null, data: orderedData };
}
