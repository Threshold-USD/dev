import React from "react";
import { Container } from "theme-ui";

export const SideBar: React.FC = ({ children }) => {

  return (
    <Container variant="sideBar">
      {children}
    </Container>
  );
};
