import React, { useState, useRef } from "react";
import { Box, Button, Container, Flex } from "theme-ui";
import { Icon } from "./Icon";
import { GenericIcon } from "./GenericIcon";
import { Link } from "./Link";

const logoHeight = "32px";

export const SideNav = (): JSX.Element => {
  const [isVisible, setIsVisible] = useState(false);
  const overlay = useRef<HTMLDivElement>(null);

  if (!isVisible) {
    return (
      <Button sx={{ display: ["flex", "none"] }} variant="icon" onClick={() => setIsVisible(true)}>
        <Icon name="bars" size="lg" />
      </Button>
    );
  }
  return (
    <Container
      variant="infoOverlay"
      ref={overlay}
      onClick={e => {
        if (e.target === overlay.current) {
          setIsVisible(false);
        }
      }}
    >
      <Flex variant="layout.sidenav">
        <Button
          sx={{ position: "fixed", right: "25vw", m: 2 }}
          variant="icon"
          onClick={() => setIsVisible(false)}
        >
          <Icon name="times" size="2x" />
        </Button>
        <GenericIcon imgSrc="./threshold-usd-icon.svg" height={logoHeight} p={2} />
        <Box as="nav" sx={{ m: 3, mt: 1, p: 0 }} onClick={() => setIsVisible(false)}>
          <Link to="/">Dashboard</Link>
          <Link to="/borrow">Borrow</Link>
          <Link to="/redemption">Redemption</Link>
          <Link to="/vaults">Vaults</Link>
          <Link to="/stability">Stability</Link>
        </Box>
      </Flex>
    </Container>
  );
};
