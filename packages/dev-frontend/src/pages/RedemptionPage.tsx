import { Container} from "theme-ui";
import { Redemption } from "../components/Redemption/Redemption";
import { PageRow } from "../components/PageRow";
import { PageHeading } from "../components/PageHeading";
import { COIN } from "../utils/constants";

export const RedemptionPage = (): JSX.Element => {
  return (
    <Container variant="singlePage">
      <PageHeading
        heading="Redeem"
        description={
          <>
            Redemptions are expected to be carried out by bots when arbitrage opportunities emerge.
            <br/>
            Most of the time you will get a better rate for converting { COIN } to the collateral on Uniswap  or other exchanges.
            <br/>
            Note: Redemption is not for repaying your loan. To repay your loan, adjust your Vault on the Dashboard.
          </>
        }
        link="https://github.com/Threshold-USD/dev"
      />
      <PageRow Component={Redemption} />
    </Container>
  );
};
