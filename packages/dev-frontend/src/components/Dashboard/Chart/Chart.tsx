import React from "react";
import { Card } from "theme-ui";

import { LineChart } from "./LineChart";

type ChartCardProps = {
  variant?: string;
};

export const Chart: React.FC<ChartCardProps> = ({ variant = "mainCards" }) => {
  return (
    <Card {...{ variant }}>
      <LineChart />
    </Card>
  );
};
