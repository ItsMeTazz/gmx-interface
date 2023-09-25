import { useMemo } from "react";
import { BigNumber } from "ethers";
import { USD_DECIMALS } from "lib/legacy";
import { expandDecimals } from "lib/numbers";
import { useOpenPositions, useAccountPerf } from ".";
import {
  PerfPeriod,
  OpenPosition,
  LiveAccountPerformance,
  AccountPositionsSummary,
  PositionsSummaryByAccount,
} from "./types";

const defaultSummary = (account: string): AccountPositionsSummary => ({
  account,
  unrealizedPnl: BigNumber.from(0),
  unrealizedPnlAfterFees: BigNumber.from(0),
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

const groupPositionsByAccount = (positions: OpenPosition[]): PositionsSummaryByAccount => {
  const groupping: PositionsSummaryByAccount = {};

  for (const p of positions) {
    const { account } = p;

    if (!groupping[account]) {
      groupping[account] = defaultSummary(account);
    }

    const summary = groupping[account];

    summary.openPositionsCount++;
    summary.unrealizedPnl = summary.unrealizedPnl.add(p.unrealizedPnl);
    summary.unrealizedPnlAfterFees = summary.unrealizedPnlAfterFees.add(p.unrealizedPnlAfterFees);
    summary.sumSize = summary.sumSize.add(p.sizeInUsd)
    summary.sumCollateral = summary.sumCollateral.add(p.collateralAmountUsd);
    summary.sumMaxSize = summary.sumMaxSize.add(p.maxSize);
    summary.totalCollateral = summary.totalCollateral.add(p.collateralAmountUsd);
    summary.priceImpactUsd = summary.priceImpactUsd.add(p.priceImpactUsd);
    summary.collectedBorrowingFeesUsd = summary.collectedBorrowingFeesUsd.add(p.collectedBorrowingFeesUsd);
    summary.collectedFundingFeesUsd = summary.collectedFundingFeesUsd.add(p.collectedFundingFeesUsd);
    summary.collectedPositionFeesUsd = summary.collectedPositionFeesUsd.add(p.collectedPositionFeesUsd);
    summary.pendingFundingFeesUsd = summary.pendingFundingFeesUsd.add(p.pendingFundingFeesUsd);
    summary.pendingClaimableFundingFeesUsd = summary.pendingClaimableFundingFeesUsd.add(p.pendingClaimableFundingFeesUsd);
    summary.pendingBorrowingFeesUsd = summary.pendingBorrowingFeesUsd.add(p.pendingBorrowingFeesUsd);
    summary.closingFeeUsd = summary.closingFeeUsd.add(p.closingFeeUsd);
  }

  return groupping;
};

export function useTopAccounts(period: PerfPeriod) {
  const accountPerf = useAccountPerf(period);
  const positions = useOpenPositions();
  const accountsHash = (accountPerf.data || []).map(a => a.account).join("-");
  const positionsHash = (positions.data || []).map(p => p.key).join("-");
  const data = useMemo(() => {
    if (accountPerf.error || positions.error || accountPerf.isLoading || positions.isLoading) {
      return;
    }

    const openPositionsByAccount: Record<string, AccountPositionsSummary> = groupPositionsByAccount(positions.data);
    const data: LiveAccountPerformance[] = [];

    for (let i = 0; i < accountPerf.data.length; i++) {
      const perf = accountPerf.data[i];
      const openPositions = openPositionsByAccount[perf.account] || defaultSummary(perf.account);
      const realizedPnl = perf.totalPnl
        .sub(perf.borrowingFeeUsd)
        .sub(perf.fundingFeeUsd)
        .sub(perf.positionFeeUsd)
        .add(perf.priceImpactUsd);

      const unrealizedPnl = openPositions.unrealizedPnl
        .sub(openPositions.pendingBorrowingFeesUsd)
        .sub(openPositions.pendingFundingFeesUsd)
        .sub(openPositions.closingFeeUsd);

      const absProfit = realizedPnl.add(unrealizedPnl);
      const maxCollateral = perf.maxCollateral;
      if (maxCollateral.isZero()) {
        throw new Error(`Account ${perf.account} max collateral is 0, please verify data integrity`);
      }
      const relProfit = absProfit.mul(expandDecimals(1, USD_DECIMALS)).div(maxCollateral);
      const cumsumCollateral = perf.cumsumCollateral;
      const cumsumSize = perf.cumsumSize;

      if (cumsumCollateral.isZero()) {
        throw new Error(`Account ${perf.account} collateral history is 0, please verify data integrity`);
      }

      const sumMaxSize = perf.sumMaxSize.add(openPositions.sumMaxSize);
      const positionsCount = perf.closedCount.add(BigNumber.from(openPositions.openPositionsCount));
      const performance = {
        id: perf.account + ":" + period,
        account: perf.account,
        absProfit,
        relProfit,
        realizedPnl,
        unrealizedPnl,
        maxCollateral,
        averageSize: sumMaxSize.div(positionsCount),
        averageLeverage: cumsumSize.mul(expandDecimals(1, USD_DECIMALS)).div(cumsumCollateral),
        wins: perf.wins,
        losses: perf.losses,
      };

      data.push(performance);
    }

    return data.sort((a, b) => a.absProfit.gt(b.absProfit) ? -1 : 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountsHash, positionsHash]);

  return {
    isLoading: !data,
    error: accountPerf.error || positions.error,
    data: data || []
  };
}
