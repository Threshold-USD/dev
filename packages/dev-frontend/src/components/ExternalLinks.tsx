import { Flex, Image, Link, useColorMode } from "theme-ui";
import { Icon } from "./Icon";

export const ExternalLinks: React.FC = () => {
  const [colorMode] = useColorMode();

  return (
    <>
      <Link variant="nav" href="https://github.com/Threshold-USD/dev" target="_blank">
        <Icon name="book" />
        Documentation
      </Link>
      <Flex sx={{
        display: "flex",
        flexDirection: "row",
        alignSelf: "center",
        bottom: 0
      }}>
        <Link variant="socialIcons" href="https://discord.com/invite/WXK9PC6SRF" target="_blank">
          <Image src={colorMode === "darkGrey" ? "./icons/grey-discord.svg" : "./icons/discord.svg"} />
        </Link>
        <Link variant="socialIcons" href="https://github.com/Threshold-USD/dev" target="_blank">
          <Image src={colorMode === "darkGrey" ? "./icons/grey-github.svg" : "./icons/github.svg"} />
        </Link>
      </Flex>
    </>
  );
};
