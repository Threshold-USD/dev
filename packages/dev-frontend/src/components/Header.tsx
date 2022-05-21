import React from "react";
import { Box, Container, Heading } from "theme-ui";
import { Link } from "./Link";
import { GenericIcon } from "./GenericIcon";
import { UserAccount } from "./UserAccount";

const logoHeight: string = "32px";

export const Header: React.FC = ({ children }) => {

  return (
    <Container variant="header">
      <Link variant="logo" to="/">
        <GenericIcon imgSrc="./threshold-usd-icon.svg" height={logoHeight} />
        <Heading sx={{ ml:"0.5em" }}>
          Threshold USD
        </Heading>
      </Link>
      <Box sx={{ display: ["none","flex"] }}>
        <UserAccount />
      </Box>
      {children}
    </Container>
  );
};
