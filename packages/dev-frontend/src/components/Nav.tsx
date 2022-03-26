import { Flex, Box } from "theme-ui";
import { Link } from "./Link";
import { Icon } from "./Icon";
import { ExternalLinks } from "./ExternalLinks";

export const Nav: React.FC = () => {
  return (
    <Box sx={{
      display: "flex",
      flexGrow: 1,
      justifyContent: "flex-start",
      flexDirection: "column",
    }}>
      <Flex sx={{
        display: "flex",
        flexGrow: 1,
        flexDirection: "column",
      }}>
        <Link to="/">
          <Icon name="columns" />
          Dashboard
        </Link>
        <Link to="/borrow">
          <Icon name="exchange-alt" />
          Borrow
        </Link>
        <Link to="/earn">
          <Icon name="chart-line" />
          Earn
        </Link>
        <Link to="/redemption">
          <Icon name="check" />
          Redeem
        </Link>
        <Link to="/risky-vaults">
          <Icon name="exclamation-triangle" />
          Risky Vaults
        </Link>
      </Flex>
      <Flex sx={{ justifyContent: "flex-end", flexDirection: "column", mr: 3, flex: 1 }}>
        <ExternalLinks />
      </Flex>
    </Box>
  );
};
