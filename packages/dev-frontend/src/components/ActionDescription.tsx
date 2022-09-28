import { Box, Flex, Text, useColorMode } from "theme-ui";

import { GenericIcon } from "./GenericIcon";

type ActionDescriptionProps = {
  title?: string;
};

export const ActionDescription: React.FC<ActionDescriptionProps> = ({ title, children }) => {
  const [colorMode] = useColorMode();

  return (
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
        borderColor: "border",
        bg: "wrapperBackground"
      }}
    >
      <Flex sx={{ alignItems: "center", fontSize: "0.9em" }}>
        <GenericIcon imgSrc={colorMode === "dark" ? "./icons/purple-rounded-info.svg" : colorMode === "darkGrey" ? "./icons/white-rounded-info.svg" :  "./icons/rounded-info.svg"} height={"18px"} />
        <Flex sx={{ alignItems: "start", flexDirection: "column", ml: "1.8em", gap: "0.5em" }}>
          <Text sx={{ color: "text" }}>{title}</Text>
          <Text sx={{ color: "greytext" }}>{children}</Text>
        </Flex>
      </Flex>
    </Box>
  )
};

export const Amount: React.FC = ({ children }) => (
  <Text sx={{ whiteSpace: "nowrap" }}>{children}</Text>
);
