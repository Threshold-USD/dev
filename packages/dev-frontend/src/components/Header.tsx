import React from "react";
import { Box, Container, Heading } from "theme-ui";
import { Link } from "./Link";
import { ThusdLogo } from "./ThusdLogo";
import { UserAccount } from "./UserAccount";

const logoHeight = "38px";

export const Header: React.FC = ({ children }) => {

  return (
    <Container variant="header">
      <Link variant="logo" to="/">
        <ThusdLogo height={logoHeight} />
        <Heading sx={{ ml:"0.5em", fontSize: 2, fontWeight: "extrabold", display:"flex" }}>
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
