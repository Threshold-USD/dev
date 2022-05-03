import { Box, Flex, Text } from "theme-ui";

import { GenericIcon } from "./GenericIcon";

type ActionDescriptionProps = {
  title?: string;
};

export const ActionDescription: React.FC<ActionDescriptionProps> = ({ title, children }) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-around",

      mb: 2,
      p: 3,

      border: 1,
      borderRadius: "8px",
      borderColor: "accent",
      bg: "rgba(250, 253, 255)"
    }}
  >
    <Flex sx={{ alignItems: "center", fontSize: "0.9em" }}>
      <GenericIcon imgSrc="./icons/rounded-info.svg" height={"18px"} />
      <Flex sx={{ alignItems: "start", flexDirection: "column", ml: "1.8em", gap: "0.5em" }}>
        <Text sx={{ color: "black" }}>{title}</Text>
        <Text sx={{ color: "grey" }}>{children}</Text>
      </Flex>
    </Flex>
  </Box>
);

export const Amount: React.FC = ({ children }) => (
  <Text sx={{ whiteSpace: "nowrap" }}>{children}</Text>
);
