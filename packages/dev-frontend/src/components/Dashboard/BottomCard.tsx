import React from "react";
import { Box, Button, Card, Flex, Link } from "theme-ui";
import { NavLink } from "react-router-dom";

import { GenericIcon } from "../GenericIcon";
import { InfoIcon } from "../InfoIcon";

type BottomCardProps = {
  title: string ;
  tooltip: string;
  action: string;
  token: string;
  path: string;
  disabled?: boolean;
};

export const BottomCard: React.FC<BottomCardProps> = ({ 
  title, 
  tooltip, 
  action, 
  token, 
  path, 
  disabled,
  children
}) => {
    return (
      <Card variant="layout.columns">
        <Flex sx={{
          width: "100%",
          gap: 1,
          pb: 3,
          borderBottom: 1, 
          borderColor: "border"
        }}>
          {title}
          <InfoIcon size="sm" tooltip={<Card variant="tooltip">{tooltip}</Card>} />
        </Flex>
        <Flex sx={{
          width: "100%",
          flexDirection: "column",
          pt: "3.4em",
          px: ["1em", 0, 0, "1.6em"],
          gap: "1em"
        }}>
          {token} available 
          <Flex variant="layout.balanceRow">
            <GenericIcon imgSrc={"./icons/threshold-icon.svg"} height={"18px"} />
            <Box sx={{ fontSize: 3 }}>
              {children}
            </Box>
            <Box sx={{ fontSize: 14, pt: 1 }}>
              {token}
            </Box>
          </Flex>
          <NavLink to={path} style={{ textDecoration: 'none' }}>
            <Button sx={{ mt: 2, width: "100%" }} disabled={disabled}>
              {action}
            </Button>
          </NavLink>
          <Flex sx={{ 
            alignSelf: "center",
            fontSize: 11,
            fontWeight: "body",
            pb: "2.4em"
          }}>
            <Link variant="cardLinks" href="https://github.com/Threshold-USD/dev#readme" target="_blank">Read about</Link>
            in the documentation
          </Flex>
        </Flex>
      </Card>
  );
};
