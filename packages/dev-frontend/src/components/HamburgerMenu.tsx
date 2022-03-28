import React, { useState, useRef } from "react";
import { Container, Button } from "theme-ui";

import { Icon } from "./Icon";
import { Nav } from "./Nav";
import { NavPopUp } from "./NavPopUp";

export const HamburgerMenu: React.FC = () => {

  const [SideBarOpen, setSideBarOpen] = useState(false);
  const SideBarOverlayRef = useRef<HTMLDivElement>(null);
  
  return (
    <>
      <Button
        onClick={() => setSideBarOpen(!SideBarOpen)}
        variant="icon"
        sx={{
          position: "relative",
          display: ["block", "none"]
        }}
      >
        <Icon name="bars" size="2x" />
      </Button>
      {SideBarOpen && (
        <Container
          variant="infoOverlay"
          ref={SideBarOverlayRef}
          onClick={e => {
            if (e.target === SideBarOverlayRef.current) {
              setSideBarOpen(false);
            }
          }}
        >
          <NavPopUp>
            <Nav />
          </NavPopUp>
        </Container>
      )}
    </>
  );
};
