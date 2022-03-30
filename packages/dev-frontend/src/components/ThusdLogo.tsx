import React from "react";
import { Box, Image } from "theme-ui";

type ThusdLogoProps = React.ComponentProps<typeof Box> & {
  height?: number | string;
};

export const ThusdLogo: React.FC<ThusdLogoProps> = ({ height, ...boxProps }) => (
  <Box sx={{ lineHeight: 0 }} {...boxProps}>
    <Image src="./threshold-usd-icon.svg" sx={{ height }} />
  </Box>
);
