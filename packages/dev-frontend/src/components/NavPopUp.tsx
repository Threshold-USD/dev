import React from "react";
import { Container, Flex, Box } from "theme-ui";

export const NavPopUp: React.FC = ({ children }) => {

  return (
    <Container sx={{right: 0}}>
      <Flex sx={{ alignItems: "start", flex: 1 }}>
        <Box
          sx={{
            display: "flex",
            mt: "4.5em",
            pt: "1em",
            height: "100%",
            width: "17em",
            position: "absolute",
            borderLeft: ["none", "1px solid lightgrey"],
            bg: "white",
            right: 0
          }}
        >
          {children}
        </Box>
      </Flex>
    </Container>
  );
};
