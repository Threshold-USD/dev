import { Box, Flex, Text } from "theme-ui";

import { Icon } from "./Icon";

export const ErrorDescription: React.FC = ({ children }) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-around",
      mt: "1.5em", 
      mb: "0.9em", 
      p: "0.9em",

      border: 1,
      borderRadius: "8px",
      borderColor: "danger",
      boxShadow: 2,
      bg: "rgba(220, 44, 16, 0.05)"
    }}
  >
    <Flex sx={{ alignItems: "center", fontSize: "0.9em" }}>
      <Icon name="exclamation-triangle" size="lg" />
      <Text sx={{ ml: 2 }}>{children}</Text>
    </Flex>
  </Box>
);
