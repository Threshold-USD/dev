import { Flex, Box } from "theme-ui";
import { Link } from "./Link";
import { Icon } from "./Icon";
import { ExternalLinks } from "./ExternalLinks";

export const Nav: React.FC = () => {
  return (
    <Box sx={{
      display: "flex",
      justifyContent: "space-between",
      flexDirection: "column",
      width: "100%"
    }}>
      <Flex sx={{
        display: "flex",
        flexGrow: 1,
        flexDirection: "column",
      }}>
        <Link to="/">
          <Icon name="chart-bar" />
          Dashboard
        </Link>
        <Link to="/borrow" >
          <Flex sx={{ transform: "rotate(155deg)" }}>
            <Icon name="exchange-alt" />
          </Flex>
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
      <Flex sx={{ justifyContent: "end", flexDirection: "column", flex: 1 }}>
        <ExternalLinks />
      </Flex>
    </Box>
  );
};
