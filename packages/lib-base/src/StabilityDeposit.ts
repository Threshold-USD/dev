import { Decimal, Decimalish } from "./Decimal";

import { 
  _LiquityContractsKeys
} from "./TransactableLiquity"

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
  /** Name of the Contract used for opening the trove. */
  readonly contractName: _LiquityContractsKeys;

  /** Amount of thUSD in the Stability Deposit at the time of the last direct modification. */
  readonly initialTHUSD: Decimal;

  /** Amount of thUSD left in the Stability Deposit. */
  readonly currentTHUSD: Decimal;

  /** Amount of native currency (e.g. Ether) received in exchange for the used-up thUSD.  */
  readonly collateralGain: Decimal;

  /** @internal */
  constructor(
    contractName: _LiquityContractsKeys, 
    initialTHUSD: Decimal,
    currentTHUSD: Decimal,
    collateralGain: Decimal
  ) {
    this.contractName = contractName;
    this.initialTHUSD = initialTHUSD;
    this.currentTHUSD = currentTHUSD;
    this.collateralGain = collateralGain;

    if (this.currentTHUSD.gt(this.initialTHUSD)) {
      throw new Error("currentTHUSD can't be greater than initialTHUSD");
    }
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
      `{ initialTHUSD: ${this.initialTHUSD}` +
      `, currentTHUSD: ${this.currentTHUSD}` +
      `, collateralGain: ${this.collateralGain} }`
    );
  }

  /**
   * Compare to another instance of `StabilityDeposit`.
   */
  equals(that: StabilityDeposit): boolean {
    return (
      this.initialTHUSD.eq(that.initialTHUSD) &&
      this.currentTHUSD.eq(that.currentTHUSD) &&
      this.collateralGain.eq(that.collateralGain)
    );
  }

  /**
   * Calculate the difference between the `currentTHUSD` in this Stability Deposit and `thatTHUSD`.
   *
   * @returns An object representing the change, or `undefined` if the deposited amounts are equal.
   */
  whatChanged(thatTHUSD: Decimalish): StabilityDepositChange<Decimal> | undefined {
    thatTHUSD = Decimal.from(thatTHUSD);

    if (thatTHUSD.lt(this.currentTHUSD)) {
      return { withdrawTHUSD: this.currentTHUSD.sub(thatTHUSD), withdrawAllTHUSD: thatTHUSD.isZero };
    }

    if (thatTHUSD.gt(this.currentTHUSD)) {
      return { depositTHUSD: thatTHUSD.sub(this.currentTHUSD) };
    }
  }

  /**
   * Apply a {@link StabilityDepositChange} to this Stability Deposit.
   *
   * @returns The new deposited thUSD amount.
   */
  apply(change: StabilityDepositChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.currentTHUSD;
    }

    if (change.withdrawTHUSD !== undefined) {
      return change.withdrawAllTHUSD || this.currentTHUSD.lte(change.withdrawTHUSD)
        ? Decimal.ZERO
        : this.currentTHUSD.sub(change.withdrawTHUSD);
    } else {
      return this.currentTHUSD.add(change.depositTHUSD);
    }
  }
}
