import React from "react";
import { Flex, Image } from "theme-ui";

type GenericIconProps = React.ComponentProps<typeof Flex> & {
  height?: number | string;
  imgSrc: string;
  justifyContent?: string;
};

export const GenericIcon = ({ imgSrc, height, justifyContent, ...boxProps }: GenericIconProps): JSX.Element => (
  <Flex sx={{ lineHeight: 0, justifyContent }} {...boxProps}>
    <Image src={imgSrc} sx={{ height }} />
  </Flex>
);
