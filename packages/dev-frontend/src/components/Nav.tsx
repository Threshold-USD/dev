import { Flex, Box, IconButton } from "theme-ui";
import { Link } from "./Link";

export const Nav: React.FC = () => {
  return (
    <Box as="nav" sx={{
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
        <Link sx={{ alignItems: "center", mb: 3 }} to="/">
          <IconButton sx={{ mr: 3, display: "flex", }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.1875 14H14M10.75 14H9.125V11.5625M11.5625 11.5625H14V9.125H13.1875M9.125 9.125H10.75M1.8125 9.125H5.0625C5.51123 9.125 5.875 9.48877 5.875 9.9375V13.1875C5.875 13.6362 5.51123 14 5.0625 14H1.8125C1.36377 14 1 13.6362 1 13.1875V9.9375C1 9.48877 1.36377 9.125 1.8125 9.125ZM9.9375 1H13.1875C13.6362 1 14 1.36377 14 1.8125V5.0625C14 5.51123 13.6362 5.875 13.1875 5.875H9.9375C9.48877 5.875 9.125 5.51123 9.125 5.0625V1.8125C9.125 1.36377 9.48877 1 9.9375 1ZM1.8125 1H5.0625C5.51123 1 5.875 1.36377 5.875 1.8125V5.0625C5.875 5.51123 5.51123 5.875 5.0625 5.875H1.8125C1.36377 5.875 1 5.51123 1 5.0625V1.8125C1 1.36377 1.36377 1 1.8125 1Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </IconButton>
            Dashboard
        </Link>
        <Link to="/farm">
          Farm
        </Link>
        <Link to="/risky-troves">
          Risky Troves
        </Link>
        <Link to="/redemption">
          Redemption
        </Link>
      </Flex>
      <Flex sx={{ justifyContent: "flex-end", flexDirection: "column", mr: 3, flex: 1 }}>
        <Link to="/">
          Documentation
        </Link>
      </Flex>
    </Box>
  );
};
