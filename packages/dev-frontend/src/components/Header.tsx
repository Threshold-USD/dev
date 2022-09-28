import React from "react";
import { Box, Container, useColorMode } from "theme-ui";
import { Link } from "./Link";
import { GenericIcon } from "./GenericIcon";
import { UserAccount } from "./UserAccount";

const logoHeight: string = "16px";

export const Header: React.FC = ({ children }) => {
  const [colorMode, setColorMode] = useColorMode();
  return (
    <Container variant="header">
      <Link variant="logo" to="/">
        <GenericIcon imgSrc={colorMode === "dark" || colorMode === "darkGrey" ? "./dark-thresholdusd-logo.svg" : "./light-thresholdusd-logo.svg"} height={logoHeight} />
      </Link>
      <Box sx={{ 
        display: ["none", "flex"],  
        alignItems: "center", 
        gap: 4 }}>
        <Box
          sx={{ cursor: "pointer" }}
          onClick={() => {
            setColorMode(colorMode === 'default' ? 'dark' : colorMode === 'dark' ? 'darkGrey' : 'default')
          }}>
          <GenericIcon imgSrc={colorMode === "dark" ? "./icons/light-moon.svg" : colorMode === "darkGrey" ? "./icons/sun.svg" : "./icons/moon.svg"} />
        </Box>
        <UserAccount />
      </Box>
      {children}
    </Container>
  );
};
