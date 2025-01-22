import { Flex, Image, Link, useColorMode } from "theme-ui";
import { Icon } from "./Icon";
import { GREY_FILTER } from "../utils/constants";

export const ExternalLinks = (): JSX.Element => {
  const [colorMode] = useColorMode();

  return (
    <>
      <Link variant="nav" href="https://docs.threshold.network/fundamentals/threshold-usd" target="_blank">
        <Icon name="book" />
        Documentation
      </Link>
      <Flex sx={{
        display: "flex",
        flexDirection: "row",
        alignSelf: "center",
        bottom: 0
      }}>
        <Link variant="socialIcons" href="https://discord.threshold.network" target="_blank">
          <Image src="./icons/discord.svg" sx={colorMode === "darkGrey" ? {filter: GREY_FILTER} : {}} />
        </Link>
        <Link variant="socialIcons" href="https://github.com/Threshold-USD/dev" target="_blank">
          <Image src="./icons/github.svg" sx={colorMode === "darkGrey" ? {filter: GREY_FILTER} : {}} />
        </Link>
      </Flex>
    </>
  );
};
