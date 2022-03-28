import { Flex, Image, Link } from "theme-ui";
import { Icon } from "./Icon";

export const ExternalLinks: React.FC = () => {
  return (
    <>
      <Link variant="nav" href="https://github.com/Threshold-USD/dev" target="_blank">
        <Icon name="book" />
        Documentation
      </Link>
      <Flex sx={{
        display: "flex",
        flexDirection: "row",
        alignSelf: "center"
      }}>
        <Link variant="socialIcons" href="https://discord.com/invite/WXK9PC6SRF" target="_blank">
          <Image src="./icons/discord.svg" />
        </Link>
        <Link variant="socialIcons" href="https://github.com/Threshold-USD/dev" target="_blank">
          <Image src="./icons/github.svg" />
        </Link>
      </Flex>
    </>
  );
};
