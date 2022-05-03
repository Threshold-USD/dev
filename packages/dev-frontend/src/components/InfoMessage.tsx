import { Box, Flex, Text } from "theme-ui";

type InfoMessageProps = {
  title: string;
  icon?: React.ReactNode;
};

export const InfoMessage: React.FC<InfoMessageProps> = ({ title, children, icon }) => (
  <Box sx={{ mx: 1, fontSize: "0.9em" }}>
    <Flex sx={{ alignItems: "center" }}>
      {icon && (
        <Box sx={{ mr: "12px" }}>{icon}</Box>
      )}
      <Text sx={{ mb: 2,  fontWeight: "bold" }}>{title}</Text>
    </Flex>

    <Text sx={{ color: "grey" }}>{children}</Text>
  </Box>
);
