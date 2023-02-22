import { Decimal, Decimalish } from "./Decimal";

/**
 * Represents the change between two Stability Deposit states.
 *
 * @public
 */
export type StabilityDepositChange<T> =
  | { depositTHUSD: T; withdrawTHUSD?: undefined }
  | { depositTHUSD?: undefined; withdrawTHUSD: T; withdrawAllTHUSD: boolean };

/**
 * A Stability Deposit and its accrued gains.
 *
 * @public
 */
export class StabilityDeposit {
 /** pool share of user in the BAMM wich has a share in the stability pool */
 readonly bammPoolShare: Decimal;

 /** pool share of user in the BAMM wich has a share in the stability pool */
 readonly poolShare: Decimal;

 /** Amount of LUSD in the Stability Deposit at the time of the last direct modification. */
 readonly initialTHUSD: Decimal;

 /** Amount of LUSD left in the Stability Deposit. */
 readonly currentTHUSD: Decimal;

 /** Amount of USD left in the Stability Deposit. */
 readonly currentUSD: Decimal;

 /** Amount of native currency (e.g. Ether) received in exchange for the used-up LUSD. */
 readonly collateralGain: Decimal;

  /**
   * Address of frontend through which this Stability Deposit was made.
   *
   * @remarks
   * If the Stability Deposit was made through a frontend that doesn't tag deposits, this will be
   * the zero-address.
   */

  readonly totalCollateralInBamm: Decimal;
  
  readonly totalThusdInBamm: Decimal;

  /** @internal */
  constructor(
    bammPoolShare: Decimal,
    poolShare: Decimal,
    initialTHUSD: Decimal,
    currentUSD: Decimal,
    currentTHUSD: Decimal,
    collateralGain: Decimal,
    totalCollateralInBamm: Decimal,
    totalThusdInBamm: Decimal
    ) {
      this.bammPoolShare = bammPoolShare;
      this.poolShare = poolShare;
      this.initialTHUSD = initialTHUSD;
      this.currentUSD = currentUSD;
      this.currentTHUSD = currentTHUSD;
      this.collateralGain = collateralGain;
      this.totalCollateralInBamm = totalCollateralInBamm;
      this.totalThusdInBamm = totalThusdInBamm;
    }
  

  get isEmpty(): boolean {
    return (
      this.initialTHUSD.isZero &&
      this.currentTHUSD.isZero &&
      this.collateralGain.isZero
    );
  }

  /** @internal */
  toString(): string {
    return (
      `{ bammPoolShare: ${this.bammPoolShare}` +
      `, poolShare: ${this.poolShare}` +
      `, initialLUSD: ${this.initialTHUSD}` +
      `, currentLUSD: ${this.currentTHUSD}` +
      `, collateralGain: ${this.collateralGain}` +
      `, totalEthInBamm: ${this.totalCollateralInBamm}` +
      `, totalLusdInBamm: ${this.totalThusdInBamm}`
    );
  }

  /**
   * Compare to another instance of `StabilityDeposit`.
   */
  equals(that: StabilityDeposit): boolean {

    return (
      this.bammPoolShare.eq(that.bammPoolShare) &&
      this.poolShare.eq(that.poolShare) &&
      this.currentUSD.eq(that.currentUSD) &&
      this.initialTHUSD.eq(that.initialTHUSD) &&
      this.currentTHUSD.eq(that.currentTHUSD) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.totalCollateralInBamm === that.totalCollateralInBamm &&
      this.totalThusdInBamm === that.totalThusdInBamm
    );
  }

  /**
   * Calculate the difference between the `currentTHUSD` in this Stability Deposit and `thatTHUSD`.
   *
   * @returns An object representing the change, or `undefined` if the deposited amounts are equal.
   */
  whatChanged(thatUSD: Decimalish): StabilityDepositChange<Decimal> | undefined {
    thatUSD = Decimal.from(thatUSD);

    if (thatUSD.lt(this.currentTHUSD)) {
      return { withdrawTHUSD: this.currentTHUSD.sub(thatUSD), withdrawAllTHUSD: thatUSD.isZero };
    }

    if (thatUSD.gt(this.currentTHUSD)) {
      return { depositTHUSD: thatUSD.sub(this.currentTHUSD) };
    }
  }

  /**
   * Apply a {@link StabilityDepositChange} to this Stability Deposit.
   *
   * @returns The new deposited thUSD amount.
   */
  apply(change: StabilityDepositChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.currentUSD;
    }

    if (change.withdrawTHUSD !== undefined) {
      return change.withdrawAllTHUSD || this.currentUSD.lte(change.withdrawTHUSD)
        ? Decimal.ZERO
        : this.currentTHUSD.sub(change.withdrawTHUSD);
    } else {
      return this.currentTHUSD.add(change.depositTHUSD);
    }
  }
}
